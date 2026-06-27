import { reorderCleanerQueue } from './assignments.service';
import { haversineKm } from '../../lib/haversine';
import { prisma } from '../../lib/prisma';
import { sendPush } from '../notifications/notifications.service';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
    },
    cleaningJob: {
      findMany: jest.fn(),
    },
    cleaningAssignment: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../lib/haversine', () => ({
  haversineKm: jest.fn(),
}));

jest.mock('../notifications/notifications.service', () => ({
  sendPush: jest.fn(),
}));

const tenantId = 'tenant-1';
const cleanerId = 'cleaner-1';
const actorId = 'actor-1';

const makeMockJob = (id: string, unitNumber: string, urgencyLevel: 'RED' | 'GREEN' | 'YELLOW', lat: number, lng: number) => ({
  id,
  tenantId,
  urgencyLevel,
  property: {
    unitNumber,
    condominium: { latitude: lat, longitude: lng },
  },
});

const mockCleaner = {
  id: cleanerId,
  tenantId,
  role: 'CLEANER',
  isActive: true,
  fcmToken: null as string | null,
};

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (fn: (tx: typeof prisma) => unknown) => fn(prisma),
  );
});

// ── reorderCleanerQueue ────────────────────────────────────────────────────

describe('reorderCleanerQueue', () => {
  test('returns 404 if cleaner not found', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      reorderCleanerQueue(tenantId, cleanerId, ['job-1'], actorId),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Cleaner not found' });
  });

  test('returns 422 if any job ID not in tenant', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner);
    // orderedJobIds has 2 items but findMany returns only 1
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([
      makeMockJob('job-1', '101', 'GREEN', -23.55, -46.63),
    ]);

    await expect(
      reorderCleanerQueue(tenantId, cleanerId, ['job-1', 'job-unknown'], actorId),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  test('returns correct estimated_cost_brl for 2 jobs (haversine mocked to 10 km)', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner);
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([
      makeMockJob('job-1', '101', 'RED', -23.55, -46.63),
      makeMockJob('job-2', '202', 'GREEN', -22.90, -43.17),
    ]);
    (prisma.cleaningAssignment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (haversineKm as jest.Mock).mockReturnValue(10.0);

    const result = await reorderCleanerQueue(tenantId, cleanerId, ['job-1', 'job-2'], actorId);

    // 1 pair of jobs → haversineKm called once → 10 km * 1.80 = 18.00
    expect(haversineKm).toHaveBeenCalledTimes(1);
    expect(result.estimated_cost_brl).toBe(18.0);
    expect(result.ordered_job_ids).toEqual(['job-1', 'job-2']);
  });

  test('estimated_cost_brl is 0 for a single job', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner);
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([
      makeMockJob('job-1', '101', 'GREEN', -23.55, -46.63),
    ]);
    (prisma.cleaningAssignment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await reorderCleanerQueue(tenantId, cleanerId, ['job-1'], actorId);

    expect(haversineKm).not.toHaveBeenCalled();
    expect(result.estimated_cost_brl).toBe(0);
  });

  test('emits warning when GREEN job appears before RED job in ordered list', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner);
    // order: GREEN then RED → RED should trigger warning
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([
      makeMockJob('job-green', '101', 'GREEN', -23.55, -46.63),
      makeMockJob('job-red', '202', 'RED', -22.90, -43.17),
    ]);
    (prisma.cleaningAssignment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (haversineKm as jest.Mock).mockReturnValue(5.0);

    const result = await reorderCleanerQueue(
      tenantId,
      cleanerId,
      ['job-green', 'job-red'],
      actorId,
    );

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('202');
    expect(result.warnings[0]).toContain('URGENTE');
  });

  test('no warning when RED job is before GREEN job', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner);
    // order: RED then GREEN → no warning
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([
      makeMockJob('job-red', '101', 'RED', -23.55, -46.63),
      makeMockJob('job-green', '202', 'GREEN', -22.90, -43.17),
    ]);
    (prisma.cleaningAssignment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (haversineKm as jest.Mock).mockReturnValue(5.0);

    const result = await reorderCleanerQueue(
      tenantId,
      cleanerId,
      ['job-red', 'job-green'],
      actorId,
    );

    expect(result.warnings).toHaveLength(0);
  });

  test('uses $transaction for sortOrder updates', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner);
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([
      makeMockJob('job-1', '101', 'GREEN', -23.55, -46.63),
      makeMockJob('job-2', '202', 'RED', -22.90, -43.17),
    ]);
    (prisma.cleaningAssignment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (haversineKm as jest.Mock).mockReturnValue(5.0);

    await reorderCleanerQueue(tenantId, cleanerId, ['job-1', 'job-2'], actorId);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.cleaningAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ jobId: 'job-1', cleanerId, tenantId }),
        data: { sortOrder: 0 },
      }),
    );
    expect(prisma.cleaningAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ jobId: 'job-2', cleanerId, tenantId }),
        data: { sortOrder: 1 },
      }),
    );
  });

  test('calls sendPush after transaction when cleaner has fcmToken', async () => {
    const cleanerWithToken = { ...mockCleaner, fcmToken: 'fcm-token-abc' };
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(cleanerWithToken);
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([
      makeMockJob('job-1', '101', 'GREEN', -23.55, -46.63),
    ]);
    (prisma.cleaningAssignment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await reorderCleanerQueue(tenantId, cleanerId, ['job-1'], actorId);

    expect(sendPush).toHaveBeenCalledWith(
      'fcm-token-abc',
      'STAY',
      'Sua rota foi atualizada',
      { type: 'route_updated' },
    );
  });

  test('does not call sendPush when cleaner has no fcmToken', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner); // fcmToken: null
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([
      makeMockJob('job-1', '101', 'GREEN', -23.55, -46.63),
    ]);
    (prisma.cleaningAssignment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await reorderCleanerQueue(tenantId, cleanerId, ['job-1'], actorId);

    expect(sendPush).not.toHaveBeenCalled();
  });

  test('includes tenantId in all Prisma queries', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner);
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([
      makeMockJob('job-1', '101', 'GREEN', -23.55, -46.63),
    ]);
    (prisma.cleaningAssignment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await reorderCleanerQueue(tenantId, cleanerId, ['job-1'], actorId);

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
    expect(prisma.cleaningJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
    expect(prisma.cleaningAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
  });
});
