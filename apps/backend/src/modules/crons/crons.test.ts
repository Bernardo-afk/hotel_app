// ── Mock node-cron before importing any job files ───────────────────────────
const mockSchedule = jest.fn();
jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: mockSchedule },
  schedule: mockSchedule,
}));

// ── Mock prisma ──────────────────────────────────────────────────────────────
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockUpdateMany = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../lib/prisma', () => ({
  prisma: {
    tenant: { findMany: mockFindMany },
    cleaningJob: {
      findMany: mockFindMany,
      count: mockCount,
      create: mockCreate,
    },
    user: { findMany: mockFindMany, updateMany: mockUpdateMany },
    property: { updateMany: mockUpdateMany },
    notificationLog: { findMany: mockFindMany, update: mockUpdate },
  },
}));

// ── Mock service dependencies ─────────────────────────────────────────────────
jest.mock('../cleaning-jobs/cleaning-jobs.service', () => ({
  recalcUrgency: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../notifications/notifications.service', () => ({
  sendPush: jest.fn().mockResolvedValue(undefined),
  sendWhatsApp: jest.fn().mockResolvedValue(undefined),
}));

// ── Import after mocks are set up ────────────────────────────────────────────
import { startCrons } from './index';

beforeEach(() => {
  jest.clearAllMocks();
});

// ── startCrons registers 7 cron tasks ────────────────────────────────────────

describe('startCrons', () => {
  it('registers exactly 7 cron jobs without throwing', () => {
    expect(() => startCrons()).not.toThrow();
    expect(mockSchedule).toHaveBeenCalledTimes(7);
  });

  it('registers the correct cron expressions', () => {
    startCrons();
    const expressions = mockSchedule.mock.calls.map((call: unknown[]) => call[0]);
    expect(expressions).toContain('*/15 * * * *'); // urgency-recalc
    expect(expressions).toContain('*/30 * * * *'); // pending-timeout & standby-timeout
    expect(expressions).toContain('*/5 * * * *');  // notification-fallback
    expect(expressions).toContain('0 20 * * *');   // daily-digest
    expect(expressions).toContain('1 0 * * *');    // property-unblock
    expect(expressions).toContain('0 0 * * *');    // streak-reset
  });
});

// ── Auto-create logic: pending-timeout callback ───────────────────────────────

describe('pending-timeout job callback', () => {
  it('calls sendWhatsApp for coordinators with whatsappNumber on old pending jobs', async () => {
    const { sendWhatsApp } = jest.requireMock('../notifications/notifications.service') as {
      sendWhatsApp: jest.Mock;
    };

    // Capture the callback registered for '*/30 * * * *' (first occurrence = pending-timeout)
    startCrons();
    // pending-timeout is the 2nd call (index 1)
    const pendingTimeoutCallback = mockSchedule.mock.calls[1][1] as () => Promise<void>;

    // First findMany → jobs; second findMany → coordinators
    mockFindMany
      .mockResolvedValueOnce([
        { id: 'job-1', tenantId: 'tenant-1', property: { id: 'prop-1' } },
      ])
      .mockResolvedValueOnce([
        { id: 'user-1', whatsappNumber: '+5511999990000' },
      ]);

    await pendingTimeoutCallback();

    expect(sendWhatsApp).toHaveBeenCalledTimes(1);
    expect(sendWhatsApp).toHaveBeenCalledWith('+5511999990000', 'Job job-1 pendente há mais de 3h.');
  });

  it('does not call sendWhatsApp when there are no overdue jobs', async () => {
    const { sendWhatsApp } = jest.requireMock('../notifications/notifications.service') as {
      sendWhatsApp: jest.Mock;
    };

    startCrons();
    const pendingTimeoutCallback = mockSchedule.mock.calls[1][1] as () => Promise<void>;

    mockFindMany.mockResolvedValueOnce([]); // no jobs

    await pendingTimeoutCallback();

    expect(sendWhatsApp).not.toHaveBeenCalled();
  });
});

// ── urgency-recalc callback ───────────────────────────────────────────────────

describe('urgency-recalc job callback', () => {
  it('calls recalcUrgency for each active tenant', async () => {
    const { recalcUrgency } = jest.requireMock('../cleaning-jobs/cleaning-jobs.service') as {
      recalcUrgency: jest.Mock;
    };

    startCrons();
    // urgency-recalc is the 1st call (index 0)
    const urgencyCallback = mockSchedule.mock.calls[0][1] as () => Promise<void>;

    mockFindMany.mockResolvedValueOnce([{ id: 'tenant-a' }, { id: 'tenant-b' }]);

    await urgencyCallback();

    expect(recalcUrgency).toHaveBeenCalledTimes(2);
    expect(recalcUrgency).toHaveBeenCalledWith('tenant-a');
    expect(recalcUrgency).toHaveBeenCalledWith('tenant-b');
  });
});
