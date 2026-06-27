import { getCoordinatorDashboard } from './dashboard.service';
import { prisma } from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    cleaningJob: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

const tenantId = 'tenant-1';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const makeJob = (overrides: Partial<{
  id: string;
  urgencyLevel: string;
  status: string;
  propertyStatus: string;
}> = {}) => ({
  id: overrides.id ?? 'job-1',
  status: overrides.status ?? 'PENDING',
  urgencyLevel: overrides.urgencyLevel ?? 'RED',
  scheduledDate: new Date('2026-06-27T00:00:00Z'),
  property: {
    id: 'prop-1',
    unitNumber: '101',
    status: overrides.propertyStatus ?? 'ACTIVE',
    condominium: { id: 'condo-1', name: 'Condo A' },
  },
  reservation: {
    checkIn: new Date('2026-06-26T12:00:00Z'),
    checkOut: new Date('2026-06-27T12:00:00Z'),
    guestName: 'Guest Name',
  },
  assignments: [
    {
      id: 'assign-1',
      cleanerId: 'cleaner-1',
      status: 'NOTIFIED',
      cleaner: { id: 'cleaner-1', name: 'Cleaner One' },
    },
  ],
});

const makeActiveCleanerWithAssignment = () => ({
  id: 'cleaner-1',
  name: 'Cleaner One',
  avatarUrl: null,
  isActive: true,
  assignments: [
    {
      id: 'assign-1',
      status: 'IN_PROGRESS',
      job: {
        id: 'job-1',
        urgencyLevel: 'RED',
        property: {
          unitNumber: '101',
          condominium: { name: 'Condo A' },
        },
      },
    },
  ],
});

const makeIdleCleaner = (id = 'cleaner-2', name = 'Cleaner Two') => ({
  id,
  name,
  avatarUrl: null,
  isActive: true,
  assignments: [],
});

function setupCountMocks(urgent = 2, attention = 3, completed = 5, pending = 1) {
  (prisma.cleaningJob.count as jest.Mock)
    .mockResolvedValueOnce(urgent)
    .mockResolvedValueOnce(attention)
    .mockResolvedValueOnce(completed)
    .mockResolvedValueOnce(pending);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getCoordinatorDashboard', () => {
  test('returns correct shape with jobs grouped by urgency level', async () => {
    setupCountMocks(2, 3, 5, 1);
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([
      makeJob({ id: 'job-1', urgencyLevel: 'RED' }),
      makeJob({ id: 'job-2', urgencyLevel: 'YELLOW' }),
      makeJob({ id: 'job-3', urgencyLevel: 'GREEN' }),
    ]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      makeActiveCleanerWithAssignment(),
      makeIdleCleaner(),
    ]);

    const result = await getCoordinatorDashboard(tenantId);

    // Top-level shape
    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('jobs_by_urgency');
    expect(result).toHaveProperty('team_live');
    expect(result).toHaveProperty('pending_count');

    // Metrics values
    expect(result.metrics).toEqual({ urgent: 2, attention: 3, completed: 5, pending: 1 });

    // Jobs grouped by urgency
    expect(result.jobs_by_urgency.RED).toHaveLength(1);
    expect(result.jobs_by_urgency.YELLOW).toHaveLength(1);
    expect(result.jobs_by_urgency.GREEN).toHaveLength(1);

    // JobCard shape
    const redCard = result.jobs_by_urgency.RED[0];
    expect(redCard).toMatchObject({
      id: 'job-1',
      urgencyLevel: 'RED',
      property: expect.objectContaining({
        unitNumber: '101',
        condominium: expect.objectContaining({ name: 'Condo A' }),
      }),
    });
    expect(typeof redCard.scheduledDate).toBe('string');

    // team_live
    expect(result.team_live).toHaveLength(2);

    // pending_count
    expect(result.pending_count).toBe(1);
  });

  test('jobs_by_urgency excludes DONE and CANCELLED jobs via query where clause', async () => {
    setupCountMocks();
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    await getCoordinatorDashboard(tenantId);

    expect(prisma.cleaningJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          status: { notIn: ['DONE', 'CANCELLED'] },
        }),
      }),
    );
  });

  test('jobs_by_urgency excludes BLOCKED property jobs via query where clause', async () => {
    setupCountMocks();
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    await getCoordinatorDashboard(tenantId);

    expect(prisma.cleaningJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          property: { status: { not: 'BLOCKED' } },
        }),
      }),
    );
  });

  test('team_live returns idle cleaners with currentAssignment null when no active assignment', async () => {
    setupCountMocks();
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      makeIdleCleaner('cleaner-1', 'Idle Cleaner'),
    ]);

    const result = await getCoordinatorDashboard(tenantId);

    expect(result.team_live).toHaveLength(1);
    const cleanerRow = result.team_live[0];
    expect(cleanerRow.id).toBe('cleaner-1');
    expect(cleanerRow.name).toBe('Idle Cleaner');
    expect(cleanerRow.currentAssignment).toBeNull();
  });

  test('pending_count reflects STAND_BY and PARTIAL jobs count', async () => {
    setupCountMocks(0, 0, 0, 7);
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getCoordinatorDashboard(tenantId);

    expect(result.pending_count).toBe(7);
    expect(result.metrics.pending).toBe(7);

    // Verify the count was called with correct status filter
    expect(prisma.cleaningJob.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          status: { in: ['STAND_BY', 'PARTIAL'] },
        }),
      }),
    );
  });

  test('all prisma calls include tenantId', async () => {
    setupCountMocks();
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    await getCoordinatorDashboard(tenantId);

    // All count calls include tenantId
    const countCalls = (prisma.cleaningJob.count as jest.Mock).mock.calls;
    expect(countCalls).toHaveLength(4);
    for (const call of countCalls) {
      expect(call[0].where).toMatchObject({ tenantId });
    }

    // findMany includes tenantId
    expect(prisma.cleaningJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
  });
});
