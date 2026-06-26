import { create, list, contest, contestResponse, pay } from './transport.service';
import { prisma } from '../../lib/prisma';
import { haversineKm } from '../../lib/haversine';
import { sendPush } from '../notifications/notifications.service';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    transportRecord: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    reimbursementPeriod: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
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
const transportId = 'transport-1';
const reimbursementId = 'reimb-1';

const mockReimbursement = {
  id: reimbursementId,
  tenantId,
  cleanerId,
  monthRef: '2026-06',
  totalAmount: 0,
  ridesCount: 0,
  status: 'OPEN',
};

const mockRecord = {
  id: transportId,
  tenantId,
  cleanerId,
  transportType: 'UBER',
  amount: '15.00',
  originName: 'Casa',
  destinationName: 'Apto 301',
  distanceKm: '5.00',
  status: 'PENDING_REVIEW',
  monthRef: '2026-06',
  reimbursementId,
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default $transaction: run callback with prisma as tx
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (fn: (tx: typeof prisma) => unknown) => fn(prisma),
  );
});

// ── create ─────────────────────────────────────────────────────────────────

describe('create', () => {
  const baseData = {
    transportType: 'UBER' as const,
    amount: 15.0,
    originName: 'Casa',
    originLat: -23.55,
    originLng: -46.63,
    destinationName: 'Apto 301',
    destinationLat: -23.56,
    destinationLng: -46.64,
  };

  test('computes distanceKm using haversineKm', async () => {
    (haversineKm as jest.Mock).mockReturnValue(5.0);
    (prisma.reimbursementPeriod.findUnique as jest.Mock).mockResolvedValue(mockReimbursement);
    (prisma.transportRecord.create as jest.Mock).mockResolvedValue(mockRecord);
    (prisma.reimbursementPeriod.update as jest.Mock).mockResolvedValue({});

    await create(tenantId, cleanerId, baseData);

    expect(haversineKm).toHaveBeenCalledWith(
      baseData.originLat,
      baseData.originLng,
      baseData.destinationLat,
      baseData.destinationLng,
    );
  });

  test('creates TransportRecord with computed distanceKm', async () => {
    (haversineKm as jest.Mock).mockReturnValue(8.5);
    (prisma.reimbursementPeriod.findUnique as jest.Mock).mockResolvedValue(mockReimbursement);
    (prisma.transportRecord.create as jest.Mock).mockResolvedValue(mockRecord);
    (prisma.reimbursementPeriod.update as jest.Mock).mockResolvedValue({});

    await create(tenantId, cleanerId, baseData);

    expect(prisma.transportRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId,
          cleanerId,
          distanceKm: expect.objectContaining({ s: 1 }), // Decimal instance
        }),
      }),
    );
  });

  test('upserts ReimbursementPeriod with tenantId', async () => {
    (haversineKm as jest.Mock).mockReturnValue(5.0);
    (prisma.reimbursementPeriod.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.reimbursementPeriod.create as jest.Mock).mockResolvedValue(mockReimbursement);
    (prisma.transportRecord.create as jest.Mock).mockResolvedValue(mockRecord);
    (prisma.reimbursementPeriod.update as jest.Mock).mockResolvedValue({});

    await create(tenantId, cleanerId, baseData);

    expect(prisma.reimbursementPeriod.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId, cleanerId }),
    });
  });

  test('throws 422 when origin and destination names are the same', async () => {
    await expect(
      create(tenantId, cleanerId, {
        ...baseData,
        originName: 'Same Place',
        destinationName: 'Same Place',
      }),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(prisma.transportRecord.create).not.toHaveBeenCalled();
  });

  test('creates record with status OK when ocrConfidence is HIGH', async () => {
    (haversineKm as jest.Mock).mockReturnValue(5.0);
    (prisma.reimbursementPeriod.findUnique as jest.Mock).mockResolvedValue(mockReimbursement);
    (prisma.transportRecord.create as jest.Mock).mockResolvedValue(mockRecord);
    (prisma.reimbursementPeriod.update as jest.Mock).mockResolvedValue({});

    await create(tenantId, cleanerId, { ...baseData, ocrConfidence: 'HIGH' });

    expect(prisma.transportRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'OK',
          amountSource: 'OCR_AUTO',
        }),
      }),
    );
  });

  test('creates record with status PENDING_REVIEW when ocrConfidence is LOW', async () => {
    (haversineKm as jest.Mock).mockReturnValue(5.0);
    (prisma.reimbursementPeriod.findUnique as jest.Mock).mockResolvedValue(mockReimbursement);
    (prisma.transportRecord.create as jest.Mock).mockResolvedValue(mockRecord);
    (prisma.reimbursementPeriod.update as jest.Mock).mockResolvedValue({});

    await create(tenantId, cleanerId, { ...baseData, ocrConfidence: 'LOW' });

    expect(prisma.transportRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING_REVIEW',
          amountSource: 'ADM_MANUAL',
        }),
      }),
    );
  });
});

// ── list ───────────────────────────────────────────────────────────────────

describe('list', () => {
  test('always includes tenantId in query', async () => {
    (prisma.transportRecord.findMany as jest.Mock).mockResolvedValue([]);

    await list(tenantId);

    expect(prisma.transportRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
  });

  test('filters by cleanerId when provided', async () => {
    (prisma.transportRecord.findMany as jest.Mock).mockResolvedValue([]);

    await list(tenantId, cleanerId);

    expect(prisma.transportRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, cleanerId }),
      }),
    );
  });

  test('filters by monthRef when provided', async () => {
    (prisma.transportRecord.findMany as jest.Mock).mockResolvedValue([]);

    await list(tenantId, undefined, '2026-06');

    expect(prisma.transportRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, monthRef: '2026-06' }),
      }),
    );
  });
});

// ── contest ────────────────────────────────────────────────────────────────

describe('contest', () => {
  test('throws 404 if transport record not found for tenant/cleaner', async () => {
    (prisma.transportRecord.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(contest(tenantId, cleanerId, transportId)).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(prisma.transportRecord.updateMany).not.toHaveBeenCalled();
  });

  test('sets status to CONTESTED using tenantId in updateMany', async () => {
    (prisma.transportRecord.findFirst as jest.Mock).mockResolvedValue(mockRecord);
    (prisma.transportRecord.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    await contest(tenantId, cleanerId, transportId);

    expect(prisma.transportRecord.updateMany).toHaveBeenCalledWith({
      where: { id: transportId, tenantId },
      data: { status: 'CONTESTED' },
    });
  });

  test('notifies ADMs with push when they have fcmToken', async () => {
    const adm = { id: 'adm-1', tenantId, role: 'ADM', fcmToken: 'token-abc' };
    (prisma.transportRecord.findFirst as jest.Mock).mockResolvedValue(mockRecord);
    (prisma.transportRecord.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([adm]);

    await contest(tenantId, cleanerId, transportId);

    expect(sendPush).toHaveBeenCalledWith(
      'token-abc',
      'Corrida contestada',
      `Corrida #${transportId}`,
      { recordId: transportId },
    );
  });
});

// ── contestResponse ────────────────────────────────────────────────────────

describe('contestResponse', () => {
  test('throws 404 if record not found', async () => {
    (prisma.transportRecord.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(contestResponse(tenantId, transportId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('sets status to CONTEST_RESOLVED with tenantId in updateMany', async () => {
    (prisma.transportRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockRecord)
      .mockResolvedValueOnce({ ...mockRecord, status: 'CONTEST_RESOLVED' });
    (prisma.transportRecord.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await contestResponse(tenantId, transportId);

    expect(prisma.transportRecord.updateMany).toHaveBeenCalledWith({
      where: { id: transportId, tenantId },
      data: expect.objectContaining({ status: 'CONTEST_RESOLVED' }),
    });
    expect(result).toMatchObject({ status: 'CONTEST_RESOLVED' });
  });
});

// ── pay ────────────────────────────────────────────────────────────────────

describe('pay', () => {
  test('throws 404 if reimbursement period not found in tenant', async () => {
    (prisma.reimbursementPeriod.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(pay(tenantId, reimbursementId, 'adm-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('marks reimbursement PAID with tenantId in updateMany', async () => {
    (prisma.reimbursementPeriod.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockReimbursement)
      .mockResolvedValueOnce({ ...mockReimbursement, status: 'PAID' });
    (prisma.reimbursementPeriod.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await pay(tenantId, reimbursementId, 'adm-1');

    expect(prisma.reimbursementPeriod.updateMany).toHaveBeenCalledWith({
      where: { id: reimbursementId, tenantId },
      data: expect.objectContaining({ status: 'PAID', paidById: 'adm-1' }),
    });
    expect(result).toMatchObject({ status: 'PAID' });
  });
});
