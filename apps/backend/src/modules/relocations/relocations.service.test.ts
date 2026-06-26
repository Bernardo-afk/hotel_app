import { suggestRelocation, confirmRelocation, blockSimultaneous } from './relocations.service';
import { prisma } from '../../lib/prisma';
import { validateTransition } from '../cleaning-jobs/job-status-machine';
import { sendPush } from '../notifications/notifications.service';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    cleaningAssignment: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    cleaningJob: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    jobEventLog: {
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../cleaning-jobs/job-status-machine', () => ({
  validateTransition: jest.fn(),
}));

jest.mock('../notifications/notifications.service', () => ({
  sendPush: jest.fn(),
}));

const tenantId = 'tenant-1';
const cleanerId = 'cleaner-1';
const actorId = 'actor-1';
const fromJobId = 'job-from';
const toJobId = 'job-to';

const mockProperty = { id: 'prop-1', status: 'ACTIVE' };

const mockFromJob = {
  id: fromJobId,
  tenantId,
  status: 'IN_PROGRESS' as const,
  urgencyLevel: 'RED',
  property: mockProperty,
};

const mockToJob = {
  id: toJobId,
  tenantId,
  status: 'PENDING' as const,
  urgencyLevel: 'RED',
  property: mockProperty,
};

const mockAssignment = {
  id: 'assign-new',
  tenantId,
  jobId: toJobId,
  cleanerId,
  status: 'NOTIFIED',
};

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (fn: (tx: typeof prisma) => unknown) => fn(prisma),
  );
});

// ── suggestRelocation ──────────────────────────────────────────────────────

describe('suggestRelocation', () => {
  test('returns [] when cleaner has no active assignment', async () => {
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await suggestRelocation(tenantId, cleanerId);

    expect(result).toEqual([]);
    expect(prisma.cleaningJob.findMany).not.toHaveBeenCalled();
  });

  test('returns urgent RED PENDING jobs when cleaner has active assignment', async () => {
    const activeAssignment = { id: 'assign-1', tenantId, cleanerId, status: 'IN_PROGRESS' };
    const urgentJobs = [mockToJob];
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(activeAssignment);
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue(urgentJobs);

    const result = await suggestRelocation(tenantId, cleanerId);

    expect(result).toEqual(urgentJobs);
    expect(prisma.cleaningJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, status: 'PENDING', urgencyLevel: 'RED' }),
      }),
    );
  });
});

// ── confirmRelocation ──────────────────────────────────────────────────────

describe('confirmRelocation', () => {
  test('throws 422 if fromJob is BLOCKED', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock)
      .mockResolvedValueOnce({ ...mockFromJob, status: 'BLOCKED' })
      .mockResolvedValueOnce(mockToJob);

    await expect(
      confirmRelocation(tenantId, fromJobId, toJobId, cleanerId, actorId),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('throws 422 if toJob is BLOCKED', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockFromJob)
      .mockResolvedValueOnce({ ...mockToJob, status: 'BLOCKED' });

    await expect(
      confirmRelocation(tenantId, fromJobId, toJobId, cleanerId, actorId),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('happy path: fromJob → STAND_BY, toJob → ASSIGNED, assignment created', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockFromJob)
      .mockResolvedValueOnce(mockToJob);
    (prisma.cleaningAssignment.create as jest.Mock).mockResolvedValue(mockAssignment);
    (prisma.cleaningJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.jobEventLog.create as jest.Mock).mockResolvedValue({});
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: cleanerId, fcmToken: null });

    const result = await confirmRelocation(tenantId, fromJobId, toJobId, cleanerId, actorId);

    expect(validateTransition).toHaveBeenCalledWith('IN_PROGRESS', 'STAND_BY');
    expect(validateTransition).toHaveBeenCalledWith('PENDING', 'ASSIGNED');

    expect(prisma.cleaningJob.updateMany).toHaveBeenCalledWith({
      where: { id: fromJobId, tenantId },
      data: { status: 'STAND_BY' },
    });

    expect(prisma.cleaningAssignment.create).toHaveBeenCalledWith({
      data: { tenantId, jobId: toJobId, cleanerId, status: 'NOTIFIED' },
    });

    expect(prisma.cleaningJob.updateMany).toHaveBeenCalledWith({
      where: { id: toJobId, tenantId },
      data: { status: 'ASSIGNED' },
    });

    expect(result).toEqual(mockAssignment);
    expect(sendPush).not.toHaveBeenCalled(); // no fcmToken
  });

  test('sends push when cleaner has fcmToken', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockFromJob)
      .mockResolvedValueOnce(mockToJob);
    (prisma.cleaningAssignment.create as jest.Mock).mockResolvedValue(mockAssignment);
    (prisma.cleaningJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.jobEventLog.create as jest.Mock).mockResolvedValue({});
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({
      id: cleanerId,
      fcmToken: 'fcm-token-abc',
    });

    await confirmRelocation(tenantId, fromJobId, toJobId, cleanerId, actorId);

    expect(sendPush).toHaveBeenCalledWith(
      'fcm-token-abc',
      'Realocação urgente!',
      'Você foi realocado para um novo serviço',
      { fromJobId, toJobId },
    );
  });
});

// ── blockSimultaneous ──────────────────────────────────────────────────────

describe('blockSimultaneous', () => {
  test('throws 404 if job not found', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(blockSimultaneous(tenantId, fromJobId)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('validates transition and sets job to BLOCKED', async () => {
    const job = { id: fromJobId, tenantId, status: 'PENDING' };
    const updatedJob = { ...job, status: 'BLOCKED' };
    (prisma.cleaningJob.findFirst as jest.Mock)
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(updatedJob);
    (prisma.cleaningJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await blockSimultaneous(tenantId, fromJobId);

    expect(validateTransition).toHaveBeenCalledWith('PENDING', 'BLOCKED');
    expect(prisma.cleaningJob.updateMany).toHaveBeenCalledWith({
      where: { id: fromJobId, tenantId },
      data: { status: 'BLOCKED' },
    });
    expect(result).toEqual(updatedJob);
  });
});
