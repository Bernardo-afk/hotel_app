import { assignCleaner, listAssignments, removeAssignment } from './assignments.service';
import { haversineKm } from '../../lib/haversine';
import { prisma } from '../../lib/prisma';
import { isAvailable } from '../availability/availability.service';
import { transitionJob } from '../cleaning-jobs/cleaning-jobs.service';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    cleaningJob: {
      findFirst: jest.fn(),
    },
    cleaningAssignment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock('../availability/availability.service', () => ({
  isAvailable: jest.fn(),
}));

jest.mock('../cleaning-jobs/cleaning-jobs.service', () => ({
  transitionJob: jest.fn(),
}));

const tenantId = 'tenant-1';
const jobId = 'job-1';
const cleanerId = 'cleaner-1';

const mockJob = {
  id: jobId,
  tenantId,
  propertyId: 'prop-1',
  status: 'PENDING',
  scheduledDate: new Date('2026-07-01T10:00:00Z'),
  property: {
    id: 'prop-1',
    status: 'ACTIVE',
    condominium: { id: 'condo-1', latitude: -23.5505, longitude: -46.6333 },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
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

    await expect(assignCleaner(tenantId, jobId, cleanerId)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(prisma.cleaningAssignment.create).not.toHaveBeenCalled();
  });

  test('throws 422 if cleaner not available', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (isAvailable as jest.Mock).mockResolvedValue(false);

    await expect(assignCleaner(tenantId, jobId, cleanerId)).rejects.toMatchObject({
      statusCode: 422,
      message: 'Cleaner not available',
    });
    expect(prisma.cleaningAssignment.create).not.toHaveBeenCalled();
  });

  test('creates assignment + transitions job to ASSIGNED', async () => {
    const mockAssignment = { id: 'assign-1', tenantId, jobId, cleanerId, status: 'NOTIFIED' };
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (isAvailable as jest.Mock).mockResolvedValue(true);
    (prisma.cleaningAssignment.create as jest.Mock).mockResolvedValue(mockAssignment);
    (transitionJob as jest.Mock).mockResolvedValue({ ...mockJob, status: 'ASSIGNED' });

    const result = await assignCleaner(tenantId, jobId, cleanerId);

    expect(result).toEqual(mockAssignment);
    expect(prisma.cleaningAssignment.create).toHaveBeenCalledWith({
      data: { tenantId, jobId, cleanerId },
    });
    expect(transitionJob).toHaveBeenCalledWith(tenantId, jobId, 'ASSIGNED', cleanerId);
  });

  test('throws 404 if job not found', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(assignCleaner(tenantId, jobId, cleanerId)).rejects.toMatchObject({
      statusCode: 404,
    });
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

    await expect(removeAssignment(tenantId, 'nonexistent')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('deletes assignment and transitions job back to PENDING', async () => {
    const mockAssignment = { id: 'assign-1', tenantId, jobId, cleanerId };
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(mockAssignment);
    (prisma.cleaningAssignment.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (transitionJob as jest.Mock).mockResolvedValue({ ...mockJob, status: 'PENDING' });

    const result = await removeAssignment(tenantId, 'assign-1');

    expect(result).toEqual({ deleted: true });
    expect(prisma.cleaningAssignment.deleteMany).toHaveBeenCalledWith({
      where: { id: 'assign-1', tenantId },
    });
    expect(transitionJob).toHaveBeenCalledWith(tenantId, jobId, 'PENDING', 'system');
  });
});
