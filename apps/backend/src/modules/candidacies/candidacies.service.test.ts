import {
  applyCandidacy,
  listCandidacies,
  acceptCandidacy,
  rejectCandidacy,
} from './candidacies.service';
import { prisma } from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    cleaningJob: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    candidacyRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    cleaningAssignment: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const tenantId = 'tenant-1';
const cleanerId = 'cleaner-1';
const jobId = 'job-1';
const candidacyId = 'cand-1';
const actorId = 'actor-1';

const mockJob = {
  id: jobId,
  tenantId,
  status: 'PENDING' as const,
  property: { id: 'prop-1', status: 'ACTIVE' },
};

const mockCandidacy = {
  id: candidacyId,
  tenantId,
  jobId,
  cleanerId,
  status: 'PENDING' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (fn: (tx: typeof prisma) => unknown) => fn(prisma),
  );
});

// ── applyCandidacy ─────────────────────────────────────────────────────────

describe('applyCandidacy', () => {
  test('throws 404 if job not found', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(applyCandidacy(tenantId, cleanerId, jobId)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(prisma.candidacyRequest.create).not.toHaveBeenCalled();
  });

  test('throws 422 if property is BLOCKED', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue({
      ...mockJob,
      property: { id: 'prop-1', status: 'BLOCKED' },
    });

    await expect(applyCandidacy(tenantId, cleanerId, jobId)).rejects.toMatchObject({
      statusCode: 422,
      message: 'Property is blocked',
    });
    expect(prisma.candidacyRequest.create).not.toHaveBeenCalled();
  });

  test('throws 422 if job is not PENDING', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue({
      ...mockJob,
      status: 'ASSIGNED',
    });

    await expect(applyCandidacy(tenantId, cleanerId, jobId)).rejects.toMatchObject({
      statusCode: 422,
      message: 'Job is not available for candidacy',
    });
    expect(prisma.candidacyRequest.create).not.toHaveBeenCalled();
  });

  test('throws 409 if duplicate candidacy exists', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (prisma.candidacyRequest.findFirst as jest.Mock).mockResolvedValue(mockCandidacy);

    await expect(applyCandidacy(tenantId, cleanerId, jobId)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prisma.candidacyRequest.create).not.toHaveBeenCalled();
  });

  test('creates candidacy on happy path', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (prisma.candidacyRequest.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.candidacyRequest.create as jest.Mock).mockResolvedValue(mockCandidacy);

    const result = await applyCandidacy(tenantId, cleanerId, jobId);

    expect(result).toEqual(mockCandidacy);
    expect(prisma.candidacyRequest.create).toHaveBeenCalledWith({
      data: { tenantId, cleanerId, jobId, status: 'PENDING' },
    });
  });
});

// ── listCandidacies ────────────────────────────────────────────────────────

describe('listCandidacies', () => {
  test('filters by tenantId', async () => {
    const mockList = [mockCandidacy];
    (prisma.candidacyRequest.findMany as jest.Mock).mockResolvedValue(mockList);

    const result = await listCandidacies(tenantId);

    expect(result).toEqual(mockList);
    expect(prisma.candidacyRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
  });

  test('filters by jobId when provided', async () => {
    (prisma.candidacyRequest.findMany as jest.Mock).mockResolvedValue([]);

    await listCandidacies(tenantId, { jobId });

    expect(prisma.candidacyRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, jobId }),
      }),
    );
  });

  test('filters by cleanerId when provided', async () => {
    (prisma.candidacyRequest.findMany as jest.Mock).mockResolvedValue([]);

    await listCandidacies(tenantId, { cleanerId });

    expect(prisma.candidacyRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, cleanerId }),
      }),
    );
  });
});

// ── acceptCandidacy ────────────────────────────────────────────────────────

describe('acceptCandidacy', () => {
  test('throws 404 if candidacy not found', async () => {
    (prisma.candidacyRequest.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(acceptCandidacy(tenantId, candidacyId, actorId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('throws 422 if candidacy is not PENDING', async () => {
    (prisma.candidacyRequest.findFirst as jest.Mock).mockResolvedValue({
      ...mockCandidacy,
      status: 'APPROVED',
    });

    await expect(acceptCandidacy(tenantId, candidacyId, actorId)).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  test('rejects all other PENDING candidacies for same job', async () => {
    (prisma.candidacyRequest.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockCandidacy) // initial lookup
      .mockResolvedValueOnce({ ...mockCandidacy, status: 'APPROVED' }); // tx return
    (prisma.candidacyRequest.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.cleaningAssignment.create as jest.Mock).mockResolvedValue({});
    (prisma.cleaningJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await acceptCandidacy(tenantId, candidacyId, actorId);

    // Accept the candidacy
    expect(prisma.candidacyRequest.updateMany).toHaveBeenCalledWith({
      where: { id: candidacyId, tenantId },
      data: { status: 'APPROVED' },
    });

    // Reject other pending candidacies for same job
    expect(prisma.candidacyRequest.updateMany).toHaveBeenCalledWith({
      where: {
        jobId: mockCandidacy.jobId,
        tenantId,
        status: 'PENDING',
        id: { not: candidacyId },
      },
      data: { status: 'REJECTED' },
    });

    // Create assignment
    expect(prisma.cleaningAssignment.create).toHaveBeenCalledWith({
      data: {
        tenantId,
        jobId: mockCandidacy.jobId,
        cleanerId: mockCandidacy.cleanerId,
        status: 'NOTIFIED',
      },
    });

    // Transition job to ASSIGNED
    expect(prisma.cleaningJob.updateMany).toHaveBeenCalledWith({
      where: { id: mockCandidacy.jobId, tenantId },
      data: { status: 'ASSIGNED' },
    });
  });
});

// ── rejectCandidacy ────────────────────────────────────────────────────────

describe('rejectCandidacy', () => {
  test('sets candidacy status to REJECTED', async () => {
    const rejectedCandidacy = { ...mockCandidacy, status: 'REJECTED' as const };
    (prisma.candidacyRequest.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.candidacyRequest.findFirst as jest.Mock).mockResolvedValue(rejectedCandidacy);

    const result = await rejectCandidacy(tenantId, candidacyId);

    expect(prisma.candidacyRequest.updateMany).toHaveBeenCalledWith({
      where: { id: candidacyId, tenantId },
      data: { status: 'REJECTED' },
    });
    expect(result).toEqual(rejectedCandidacy);
  });
});
