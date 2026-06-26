import { sendPush, sendWhatsApp, logNotification } from './notifications.service';
import { prisma } from '../../lib/prisma';

// ── Firebase Admin mock ──────────────────────────────────────────────────────
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(() => ({ name: 'mock-app' })),
  credential: { cert: jest.fn() },
  messaging: jest.fn(() => ({
    send: jest.fn().mockResolvedValue('msg-id'),
  })),
}));

// ── Prisma mock ──────────────────────────────────────────────────────────────
jest.mock('../../lib/prisma', () => ({
  prisma: {
    notificationLog: {
      create: jest.fn(),
    },
  },
}));

const mockCreate = prisma.notificationLog.create as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.WHATSAPP_API_URL;
  delete process.env.WHATSAPP_API_KEY;
});

// ── sendPush ─────────────────────────────────────────────────────────────────

test('sendPush is a no-op when FIREBASE_SERVICE_ACCOUNT_JSON is not set', async () => {
  // env var is absent (cleared in beforeEach)
  const adminMock = jest.requireMock('firebase-admin') as {
    messaging: jest.Mock;
  };
  await expect(sendPush('device-token', 'Title', 'Body')).resolves.toBeUndefined();
  expect(adminMock.messaging).not.toHaveBeenCalled();
});

// ── sendWhatsApp ─────────────────────────────────────────────────────────────

test('sendWhatsApp is a no-op when WHATSAPP_API_URL is not set', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true });
  global.fetch = fetchMock as typeof fetch;

  await expect(sendWhatsApp('+5511999999999', 'Hello')).resolves.toBeUndefined();
  expect(fetchMock).not.toHaveBeenCalled();
});

// ── logNotification ──────────────────────────────────────────────────────────

test('logNotification calls prisma.notificationLog.create with tenantId', async () => {
  mockCreate.mockResolvedValue({ id: 'log-1' });

  await logNotification('tenant-1', {
    userId: 'user-1',
    channel: 'PUSH',
    title: 'Job assigned',
    body: 'You have a new cleaning job.',
  });

  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'user-1',
      channel: 'PUSH',
      title: 'Job assigned',
      body: 'You have a new cleaning job.',
    }),
  });
});

test('logNotification omits relatedId from prisma create call', async () => {
  mockCreate.mockResolvedValue({ id: 'log-2' });

  await logNotification('tenant-2', {
    userId: 'user-2',
    channel: 'WHATSAPP',
    title: 'Update',
    body: 'Job status changed.',
    relatedId: 'job-99',
  });

  const callArg = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
  expect(callArg.data).not.toHaveProperty('relatedId');
  expect(callArg.data).toHaveProperty('tenantId', 'tenant-2');
});
