import {
  assignCleaner,
  cantFinish,
  doorKnocked,
  listAssignments,
  removeAssignment,
  startCleaning,
} from './assignments.service';
import { haversineKm } from '../../lib/haversine';
import { prisma } from '../../lib/prisma';
import { isAvailable } from '../availability/availability.service';
import { validateTransition } from '../cleaning-jobs/job-status-machine';
import { sendPush } from '../notifications/notifications.service';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    cleaningJob: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    cleaningAssignment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    jobEventLog: {
      create: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../availability/availability.service', () => ({
  isAvailable: jest.fn(),
}));

jest.mock('../cleaning-jobs/job-status-machine', () => ({
  validateTransition: jest.fn(),
}));

jest.mock('../notifications/notifications.service', () => ({
  sendPush: jest.fn(),
}));

const tenantId = 'tenant-1';
const jobId = 'job-1';
const cleanerId = 'cleaner-1';
const actorId = 'actor-1';
const assignmentId = 'assign-1';

const mockJob = {
  id: jobId,
  tenantId,
  propertyId: 'prop-1',
  status: 'PENDING' as const,
  scheduledDate: new Date('2026-07-01T10:00:00Z'),
  property: {
    id: 'prop-1',
    status: 'ACTIVE',
    condominium: { id: 'condo-1', latitude: -23.5505, longitude: -46.6333 },
  },
};

const mockCleaner = {
  id: cleanerId,
  tenantId,
  role: 'CLEANER',
  isActive: true,
  fcmToken: null as string | null,
};

const mockAssignment = {
  id: assignmentId,
  tenantId,
  jobId,
  cleanerId,
  status: 'NOTIFIED',
  doorKnockedAt: null as Date | null,
  startedAt: null as Date | null,
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default $transaction implementation: run the callback with prisma as tx
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (fn: (tx: typeof prisma) => unknown) => fn(prisma),
  );
});

// ── Haversine unit test ────────────────────────────────────────────────────

test('SP → RJ ≈ 357km', () => {
  const d = haversineKm(-23.5505, -46.6333, -22.9068, -43.1729);
  expect(d).toBeGreaterThan(350);
  expect(d).toBeLessThan(365);
});

// ── assignCleaner ──────────────────────────────────────────────────────────

describe('assignCleaner', () => {
  test('throws 422 if property is BLOCKED', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue({
      ...mockJob,
      property: { ...mockJob.property, status: 'BLOCKED' },
    });

    await expect(assignCleaner(tenantId, jobId, cleanerId, false, actorId)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(prisma.cleaningAssignment.create).not.toHaveBeenCalled();
  });

  test('throws 422 if cleaner not available', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner);
    (isAvailable as jest.Mock).mockResolvedValue(false);

    await expect(assignCleaner(tenantId, jobId, cleanerId, false, actorId)).rejects.toMatchObject({
      statusCode: 422,
      message: 'Cleaner not available',
    });
    expect(prisma.cleaningAssignment.create).not.toHaveBeenCalled();
  });

  test('throws 404 if job not found', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(assignCleaner(tenantId, jobId, cleanerId, false, actorId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('throws 404 if cleaner not found', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(assignCleaner(tenantId, jobId, cleanerId, false, actorId)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Cleaner not found',
    });
  });

  test('creates assignment + transitions job to ASSIGNED (happy path)', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner); // fcmToken: null
    (isAvailable as jest.Mock).mockResolvedValue(true);
    (prisma.cleaningAssignment.create as jest.Mock).mockResolvedValue(mockAssignment);
    (prisma.cleaningJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.jobEventLog.create as jest.Mock).mockResolvedValue({});

    const result = await assignCleaner(tenantId, jobId, cleanerId, false, actorId);

    expect(result).toEqual(mockAssignment);
    expect(prisma.cleaningAssignment.create).toHaveBeenCalledWith({
      data: { tenantId, jobId, cleanerId, isJoint: false, status: 'NOTIFIED' },
    });
    expect(prisma.cleaningJob.updateMany).toHaveBeenCalledWith({
      where: { id: jobId, tenantId },
      data: { status: 'ASSIGNED' },
    });
    expect(sendPush).not.toHaveBeenCalled(); // no fcmToken
  });

  test('sends push notification when cleaner has fcmToken', async () => {
    const cleanerWithToken = { ...mockCleaner, fcmToken: 'token-abc' };
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(cleanerWithToken);
    (isAvailable as jest.Mock).mockResolvedValue(true);
    (prisma.cleaningAssignment.create as jest.Mock).mockResolvedValue(mockAssignment);
    (prisma.cleaningJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.jobEventLog.create as jest.Mock).mockResolvedValue({});

    await assignCleaner(tenantId, jobId, cleanerId, false, actorId);

    expect(sendPush).toHaveBeenCalledWith(
      'token-abc',
      'Nova limpeza atribuída!',
      `Job ${jobId}`,
      { jobId },
    );
  });
});

// ── doorKnocked ────────────────────────────────────────────────────────────

describe('doorKnocked', () => {
  test('throws 404 if assignment not found', async () => {
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(doorKnocked(tenantId, assignmentId)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('sets doorKnockedAt', async () => {
    const updated = { ...mockAssignment, doorKnockedAt: new Date() };
    (prisma.cleaningAssignment.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockAssignment) // initial lookup
      .mockResolvedValueOnce(updated); // return after update
    (prisma.cleaningAssignment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await doorKnocked(tenantId, assignmentId);

    expect(prisma.cleaningAssignment.updateMany).toHaveBeenCalledWith({
      where: { id: assignmentId, tenantId },
      data: expect.objectContaining({ doorKnockedAt: expect.any(Date) }),
    });
    expect(result).toEqual(updated);
  });
});

// ── startCleaning ──────────────────────────────────────────────────────────

describe('startCleaning', () => {
  test('throws 404 if assignment not found', async () => {
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(startCleaning(tenantId, assignmentId, actorId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('transitions assignment and job to IN_PROGRESS', async () => {
    const assignmentWithJob = {
      ...mockAssignment,
      jobId,
      job: { ...mockJob, status: 'ASSIGNED' as const },
    };
    const updatedAssignment = { ...mockAssignment, status: 'IN_PROGRESS', startedAt: new Date() };

    (prisma.cleaningAssignment.findFirst as jest.Mock)
      .mockResolvedValueOnce(assignmentWithJob) // initial lookup (outside tx)
      .mockResolvedValueOnce(updatedAssignment); // inside tx at end
    (prisma.cleaningAssignment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.cleaningJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.jobEventLog.create as jest.Mock).mockResolvedValue({});

    const result = await startCleaning(tenantId, assignmentId, actorId);

    expect(validateTransition).toHaveBeenCalledWith('ASSIGNED', 'IN_PROGRESS');
    expect(prisma.cleaningAssignment.updateMany).toHaveBeenCalledWith({
      where: { id: assignmentId, tenantId },
      data: expect.objectContaining({ status: 'IN_PROGRESS', startedAt: expect.any(Date) }),
    });
    expect(prisma.cleaningJob.updateMany).toHaveBeenCalledWith({
      where: { id: jobId, tenantId },
      data: { status: 'IN_PROGRESS' },
    });
    expect(result).toEqual(updatedAssignment);
  });
});

// ── cantFinish ─────────────────────────────────────────────────────────────

describe('cantFinish', () => {
  test('throws 404 if assignment not found', async () => {
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(cantFinish(tenantId, assignmentId, actorId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('transitions assignment and job to PARTIAL', async () => {
    const assignmentWithJob = {
      ...mockAssignment,
      jobId,
      job: { ...mockJob, status: 'IN_PROGRESS' as const },
    };
    const updatedAssignment = { ...mockAssignment, status: 'PARTIAL' };

    (prisma.cleaningAssignment.findFirst as jest.Mock)
      .mockResolvedValueOnce(assignmentWithJob) // initial lookup
      .mockResolvedValueOnce(updatedAssignment); // inside tx at end
    (prisma.cleaningAssignment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.cleaningJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.jobEventLog.create as jest.Mock).mockResolvedValue({});

    const result = await cantFinish(tenantId, assignmentId, actorId);

    expect(validateTransition).toHaveBeenCalledWith('IN_PROGRESS', 'PARTIAL');
    expect(prisma.cleaningAssignment.updateMany).toHaveBeenCalledWith({
      where: { id: assignmentId, tenantId },
      data: { status: 'PARTIAL' },
    });
    expect(prisma.cleaningJob.updateMany).toHaveBeenCalledWith({
      where: { id: jobId, tenantId },
      data: { status: 'PARTIAL' },
    });
    expect(result).toEqual(updatedAssignment);
  });
});

// ── listAssignments ────────────────────────────────────────────────────────

describe('listAssignments', () => {
  test('filters by tenantId', async () => {
    const mockList = [{ id: 'a1', tenantId, jobId, cleanerId }];
    (prisma.cleaningAssignment.findMany as jest.Mock).mockResolvedValue(mockList);

    const result = await listAssignments(tenantId);

    expect(result).toEqual(mockList);
    expect(prisma.cleaningAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
  });

  test('filters by jobId when provided', async () => {
    (prisma.cleaningAssignment.findMany as jest.Mock).mockResolvedValue([]);

    await listAssignments(tenantId, { jobId });

    expect(prisma.cleaningAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, jobId }),
      }),
    );
  });
});

// ── removeAssignment ───────────────────────────────────────────────────────

describe('removeAssignment', () => {
  test('throws 404 if assignment not found', async () => {
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(removeAssignment(tenantId, 'nonexistent', actorId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('deletes assignment and transitions job back to PENDING', async () => {
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(mockAssignment);
    (prisma.cleaningAssignment.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.cleaningJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.jobEventLog.create as jest.Mock).mockResolvedValue({});

    const result = await removeAssignment(tenantId, assignmentId, actorId);

    expect(result).toEqual({ deleted: true });
    expect(prisma.cleaningAssignment.deleteMany).toHaveBeenCalledWith({
      where: { id: assignmentId, tenantId },
    });
    expect(prisma.cleaningJob.updateMany).toHaveBeenCalledWith({
      where: { id: jobId, tenantId },
      data: { status: 'PENDING' },
    });
  });
});
