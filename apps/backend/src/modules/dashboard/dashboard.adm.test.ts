import {
  getAdmDashboard,
  getAdmCoordinatorPanel,
  getAlertStrip,
} from './dashboard.service';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    cleaningJob: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    maintenanceTicket: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    property: {
      findMany: jest.fn(),
    },
  },
}));

const tenantId = 'tenant-adm-1';

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupAdmDashboardMocks(overrides: {
  coordinatorUsers?: object[];
  cleaningJobCount?: number;
  userCount?: number;
  ticketCount?: number;
} = {}) {
  const { coordinatorUsers = [], cleaningJobCount = 0, userCount = 0, ticketCount = 0 } = overrides;

  (prisma.cleaningJob.count as jest.Mock).mockResolvedValue(cleaningJobCount);
  (prisma.maintenanceTicket.count as jest.Mock).mockResolvedValue(ticketCount);
  (prisma.user.count as jest.Mock).mockResolvedValue(userCount);
  (prisma.user.findMany as jest.Mock).mockResolvedValue(coordinatorUsers);
  // getAlertStrip queries
  (prisma.property.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.maintenanceTicket.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([]);
}

function makeProperty(unitNumber = '101', condominiumName = 'Condo A') {
  return {
    id: `prop-${unitNumber}`,
    unitNumber,
    status: 'BLOCKED',
    tenantId,
    condominiumId: 'condo-1',
    condominium: { id: 'condo-1', name: condominiumName },
    reservations: [{ id: 'res-1' }],
  };
}

function makeTicket(createdAtOffset: number) {
  const createdAt = new Date(Date.now() - createdAtOffset * 60 * 1000);
  return {
    id: 'ticket-1',
    tenantId,
    status: 'OPEN',
    description: 'Water leak in bathroom',
    createdAt,
    updatedAt: new Date(),
  };
}

function makeUrgentJob() {
  return {
    id: 'job-urgent-1',
    tenantId,
    status: 'PENDING',
    urgencyLevel: 'RED',
    updatedAt: new Date(),
    property: {
      id: 'prop-1',
      unitNumber: '202',
      condominium: { name: 'Condo B' },
    },
  };
}

function makeStandByJob(lastEventMinutesAgo: number | null) {
  const updatedAt = new Date(Date.now() - (lastEventMinutesAgo ?? 0) * 60 * 1000);
  return {
    id: 'job-standby-1',
    tenantId,
    status: 'STAND_BY',
    updatedAt,
    property: {
      id: 'prop-2',
      unitNumber: '303',
      condominium: { name: 'Condo C' },
    },
    eventLogs:
      lastEventMinutesAgo !== null
        ? [{ id: 'event-1', createdAt: new Date(Date.now() - lastEventMinutesAgo * 60 * 1000) }]
        : [],
  };
}

// ── getAdmDashboard ──────────────────────────────────────────────────────────

describe('getAdmDashboard', () => {
  test('returns correct shape with metrics, coordinators, and alert_strip', async () => {
    setupAdmDashboardMocks({
      coordinatorUsers: [{ id: 'coord-1', name: 'Coordinator One', avatarUrl: null, isActive: true }],
      cleaningJobCount: 5,
      userCount: 3,
      ticketCount: 2,
    });

    const result = await getAdmDashboard(tenantId);

    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('coordinators');
    expect(result).toHaveProperty('alert_strip');

    expect(result.metrics).toMatchObject({
      total_apts_today: expect.any(Number),
      completed: expect.any(Number),
      urgent: expect.any(Number),
      open_tickets: expect.any(Number),
      active_cleaners: expect.any(Number),
    });

    expect(result.coordinators).toHaveLength(1);
    const coord = result.coordinators[0];
    expect(coord).toMatchObject({
      id: 'coord-1',
      name: 'Coordinator One',
      avatarUrl: null,
      isActive: true,
      stats: expect.objectContaining({
        cleaners: expect.any(Number),
        apts: expect.any(Number),
        cleaned: expect.any(Number),
        pending: expect.any(Number),
        open_tickets: expect.any(Number),
        has_alerts: expect.any(Boolean),
      }),
    });

    expect(Array.isArray(result.alert_strip)).toBe(true);
  });

  test('all prisma calls include tenantId', async () => {
    setupAdmDashboardMocks();

    await getAdmDashboard(tenantId);

    const countCalls = (prisma.cleaningJob.count as jest.Mock).mock.calls;
    for (const call of countCalls) {
      expect(call[0].where).toMatchObject({ tenantId });
    }

    const ticketCountCalls = (prisma.maintenanceTicket.count as jest.Mock).mock.calls;
    for (const call of ticketCountCalls) {
      expect(call[0].where).toMatchObject({ tenantId });
    }

    const userCountCalls = (prisma.user.count as jest.Mock).mock.calls;
    for (const call of userCountCalls) {
      expect(call[0].where).toMatchObject({ tenantId });
    }

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
  });

  test('coordinators list is empty when no coordinators exist', async () => {
    setupAdmDashboardMocks({ coordinatorUsers: [] });

    const result = await getAdmDashboard(tenantId);

    expect(result.coordinators).toHaveLength(0);
  });

  test('metrics.urgent counts RED jobs not DONE or CANCELLED', async () => {
    setupAdmDashboardMocks();

    await getAdmDashboard(tenantId);

    expect(prisma.cleaningJob.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          urgencyLevel: 'RED',
          status: { notIn: ['DONE', 'CANCELLED'] },
        }),
      }),
    );
  });
});

// ── getAdmCoordinatorPanel ───────────────────────────────────────────────────

describe('getAdmCoordinatorPanel', () => {
  test('throws AppError 404 when coordinator not found', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(getAdmCoordinatorPanel(tenantId, 'nonexistent-id')).rejects.toThrow(AppError);
    await expect(getAdmCoordinatorPanel(tenantId, 'nonexistent-id')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('validates coordinator belongs to tenant and has COORDINATOR role', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    await getAdmCoordinatorPanel(tenantId, 'coord-1').catch(() => undefined);

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'coord-1',
          tenantId,
          role: 'COORDINATOR',
        }),
      }),
    );
  });

  test('returns coordinator dashboard when coordinator exists', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'coord-1' });
    // getCoordinatorDashboard calls
    (prisma.cleaningJob.count as jest.Mock)
      .mockResolvedValueOnce(1) // urgent
      .mockResolvedValueOnce(2) // attention
      .mockResolvedValueOnce(3) // completed
      .mockResolvedValueOnce(0); // pending
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getAdmCoordinatorPanel(tenantId, 'coord-1');

    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('jobs_by_urgency');
    expect(result).toHaveProperty('team_live');
  });
});

// ── getAlertStrip ────────────────────────────────────────────────────────────

describe('getAlertStrip', () => {
  function setupAlertMocks(overrides: {
    properties?: object[];
    tickets?: object[];
    standByJobs?: object[];
    urgentJobs?: object[];
  } = {}) {
    (prisma.property.findMany as jest.Mock).mockResolvedValue(overrides.properties ?? []);
    (prisma.maintenanceTicket.findMany as jest.Mock).mockResolvedValue(overrides.tickets ?? []);
    (prisma.cleaningJob.findMany as jest.Mock)
      .mockResolvedValueOnce(overrides.standByJobs ?? [])
      .mockResolvedValueOnce(overrides.urgentJobs ?? []);
  }

  test('returns URGENT_UNASSIGNED alert when RED PENDING job has no assignment', async () => {
    setupAlertMocks({ urgentJobs: [makeUrgentJob()] });

    const result = await getAlertStrip(tenantId);

    const urgentAlert = result.alerts.find((a) => a.type === 'URGENT_UNASSIGNED');
    expect(urgentAlert).toBeDefined();
    expect(urgentAlert?.severity).toBe('CRITICAL');
    expect(urgentAlert?.message).toContain('202');
    expect(urgentAlert?.message).toContain('URGENTE');
    expect(urgentAlert?.property?.unitNumber).toBe('202');
    expect(urgentAlert?.job?.id).toBe('job-urgent-1');
  });

  test('returns BLOCKED_PROPERTY alert for blocked properties with future reservations', async () => {
    setupAlertMocks({ properties: [makeProperty('101', 'Condo A')] });

    const result = await getAlertStrip(tenantId);

    const blockedAlert = result.alerts.find((a) => a.type === 'BLOCKED_PROPERTY');
    expect(blockedAlert).toBeDefined();
    expect(blockedAlert?.severity).toBe('WARNING');
    expect(blockedAlert?.message).toContain('101');
    expect(blockedAlert?.message).toContain('bloqueado');
    expect(blockedAlert?.property?.unitNumber).toBe('101');
    expect(blockedAlert?.property?.condominium).toBe('Condo A');
  });

  test('CRITICAL_TICKET alert fires when ticket is older than 3h', async () => {
    const fourHourTicket = makeTicket(4 * 60); // 4h ago in minutes
    setupAlertMocks({ tickets: [fourHourTicket] });

    const result = await getAlertStrip(tenantId);

    const ticketAlert = result.alerts.find((a) => a.type === 'CRITICAL_TICKET');
    expect(ticketAlert).toBeDefined();
    expect(ticketAlert?.severity).toBe('CRITICAL');
    expect(ticketAlert?.ticket?.id).toBe('ticket-1');
    expect(ticketAlert?.ticket?.title).toBe('Water leak in bathroom');
    expect(ticketAlert?.elapsed_minutes).toBeGreaterThanOrEqual(4 * 60);
  });

  test('CRITICAL_TICKET query filters by createdAt older than 3h', async () => {
    setupAlertMocks();

    await getAlertStrip(tenantId);

    expect(prisma.maintenanceTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          status: 'OPEN',
          createdAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });

  test('STANDBY_TIMEOUT alert fires when last event log is older than 2h', async () => {
    const staleJob = makeStandByJob(150); // 2.5h ago
    setupAlertMocks({ standByJobs: [staleJob] });

    const result = await getAlertStrip(tenantId);

    const standByAlert = result.alerts.find((a) => a.type === 'STANDBY_TIMEOUT');
    expect(standByAlert).toBeDefined();
    expect(standByAlert?.severity).toBe('CRITICAL');
    expect(standByAlert?.message).toContain('303');
    expect(standByAlert?.elapsed_minutes).toBeGreaterThanOrEqual(150);
  });

  test('STANDBY_TIMEOUT alert does not fire when last event log is recent (< 2h)', async () => {
    const recentJob = makeStandByJob(30); // 30 minutes ago
    setupAlertMocks({ standByJobs: [recentJob] });

    const result = await getAlertStrip(tenantId);

    const standByAlert = result.alerts.find((a) => a.type === 'STANDBY_TIMEOUT');
    expect(standByAlert).toBeUndefined();
  });

  test('CRITICAL alerts appear before WARNING alerts', async () => {
    setupAlertMocks({
      properties: [makeProperty()],
      urgentJobs: [makeUrgentJob()],
    });

    const result = await getAlertStrip(tenantId);

    expect(result.alerts.length).toBeGreaterThanOrEqual(2);
    const firstCriticalIndex = result.alerts.findIndex((a) => a.severity === 'CRITICAL');
    const lastWarningIndex = result.alerts.reduceRight(
      (acc, a, i) => (a.severity === 'WARNING' && acc === -1 ? i : acc),
      -1,
    );
    if (firstCriticalIndex !== -1 && lastWarningIndex !== -1) {
      expect(firstCriticalIndex).toBeLessThan(lastWarningIndex);
    }
  });

  test('all prisma calls include tenantId', async () => {
    setupAlertMocks();

    await getAlertStrip(tenantId);

    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
    expect(prisma.maintenanceTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
    const findManyCalls = (prisma.cleaningJob.findMany as jest.Mock).mock.calls;
    for (const call of findManyCalls) {
      expect(call[0].where).toMatchObject({ tenantId });
    }
  });

  test('returns empty alerts when no conditions are met', async () => {
    setupAlertMocks();

    const result = await getAlertStrip(tenantId);

    expect(result.alerts).toHaveLength(0);
  });
});
