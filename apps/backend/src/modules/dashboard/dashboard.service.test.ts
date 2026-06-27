import { getDashboardStats, exportPdf } from './dashboard.service';
import { prisma } from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    cleaningJob: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    cleaningAssignment: {
      findMany: jest.fn(),
    },
    cleaningIncident: {
      count: jest.fn(),
    },
    maintenanceTicket: {
      count: jest.fn(),
    },
  },
}));

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    const listeners: Record<string, Array<(arg?: unknown) => void>> = {};
    const doc = {
      on(event: string, handler: (arg?: unknown) => void) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
        return doc;
      },
      fontSize: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      end: jest.fn().mockImplementation(() => {
        (listeners['data'] ?? []).forEach((h) => h(Buffer.from('pdf-data')));
        (listeners['end'] ?? []).forEach((h) => h());
      }),
    };
    return doc;
  });
});

const tenantId = 'tenant-1';

const mockGroupByStatus = [
  { status: 'PENDING', _count: { id: 3 } },
  { status: 'DONE', _count: { id: 5 } },
];

const mockGroupByUrgency = [
  { urgencyLevel: 'RED', _count: { id: 2 } },
  { urgencyLevel: 'YELLOW', _count: { id: 4 } },
  { urgencyLevel: 'GREEN', _count: { id: 6 } },
];

function setupDefaultMocks() {
  (prisma.cleaningJob.count as jest.Mock).mockResolvedValue(8);
  (prisma.cleaningJob.groupBy as jest.Mock)
    .mockResolvedValueOnce(mockGroupByStatus)
    .mockResolvedValueOnce(mockGroupByUrgency);
  (prisma.user.count as jest.Mock).mockResolvedValue(10);
  (prisma.cleaningAssignment.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.cleaningIncident.count as jest.Mock).mockResolvedValue(2);
  (prisma.maintenanceTicket.count as jest.Mock).mockResolvedValue(1);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── getDashboardStats ────────────────────────────────────────────────────────

describe('getDashboardStats', () => {
  test('always includes tenantId in all prisma calls', async () => {
    setupDefaultMocks();

    await getDashboardStats(tenantId);

    expect(prisma.cleaningJob.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
    expect(prisma.cleaningJob.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
    expect(prisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
    expect(prisma.cleaningAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
    expect(prisma.cleaningIncident.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
    expect(prisma.maintenanceTicket.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
  });

  test('returns correct shape with expected values', async () => {
    setupDefaultMocks();

    const result = await getDashboardStats(tenantId);

    expect(result).toMatchObject({
      totalJobs: 8,
      jobsByStatus: { PENDING: 3, DONE: 5 },
      totalCleaners: 10,
      avgDurationMinutes: 0,
      openIncidents: 2,
      openMaintenanceTickets: 1,
      urgencyBreakdown: { RED: 2, YELLOW: 4, GREEN: 6 },
    });
  });

  test('computes avgDurationMinutes from completed assignments', async () => {
    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000); // 60 minutes ago

    (prisma.cleaningJob.count as jest.Mock).mockResolvedValue(1);
    (prisma.cleaningJob.groupBy as jest.Mock)
      .mockResolvedValueOnce(mockGroupByStatus)
      .mockResolvedValueOnce(mockGroupByUrgency);
    (prisma.user.count as jest.Mock).mockResolvedValue(2);
    (prisma.cleaningAssignment.findMany as jest.Mock).mockResolvedValue([
      { startedAt: start, completedAt: now },
    ]);
    (prisma.cleaningIncident.count as jest.Mock).mockResolvedValue(0);
    (prisma.maintenanceTicket.count as jest.Mock).mockResolvedValue(0);

    const result = await getDashboardStats(tenantId);

    expect(result.avgDurationMinutes).toBeCloseTo(60, 0);
  });

  test('passes date filters to cleaningJob queries', async () => {
    setupDefaultMocks();

    const from = new Date('2026-01-01');
    const to = new Date('2026-06-30');
    await getDashboardStats(tenantId, { from, to });

    expect(prisma.cleaningJob.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          scheduledDate: { gte: from, lte: to },
        }),
      }),
    );
  });
});

// ── exportPdf ────────────────────────────────────────────────────────────────

describe('exportPdf', () => {
  test('returns a Buffer and a .pdf filename', async () => {
    setupDefaultMocks();

    const result = await exportPdf(tenantId);

    expect(result).toHaveProperty('buffer');
    expect(result).toHaveProperty('filename');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(typeof result.filename).toBe('string');
    expect(result.filename).toMatch(/\.pdf$/);
  });

  test('includes tenantId in prisma calls via getDashboardStats', async () => {
    setupDefaultMocks();

    await exportPdf(tenantId);

    expect(prisma.cleaningJob.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId }) }),
    );
  });
});
