import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { isAvailable, setAvailability, getAvailability } from './availability.service';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    cleanerAvailability: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  },
}));

const app = createApp();

const tenantId = 'tenant-avail-1';
const cleanerId = 'cleaner-avail-1';
const date = new Date('2026-07-01T00:00:00.000Z');

const makeToken = (role: string, id = 'user-1') =>
  'Bearer ' +
  jwt.sign({ id, tenantId, role }, process.env.JWT_SECRET!, { expiresIn: '1h' });

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxxx';
  jest.clearAllMocks();
});

// ── isAvailable unit tests ─────────────────────────────────────────────────

describe('isAvailable', () => {
  test('returns true when no record exists', async () => {
    (prisma.cleanerAvailability.findFirst as jest.Mock).mockResolvedValue(null);
    const result = await isAvailable(tenantId, cleanerId, date);
    expect(result).toBe(true);
    expect(prisma.cleanerAvailability.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, cleanerId, date, available: false }),
      }),
    );
  });

  test('returns false when record has available=false', async () => {
    const record = { id: 'av-1', tenantId, cleanerId, date, available: false, note: null };
    (prisma.cleanerAvailability.findFirst as jest.Mock).mockResolvedValue(record);
    const result = await isAvailable(tenantId, cleanerId, date);
    expect(result).toBe(false);
  });

  test('returns true when record has available=true', async () => {
    // findFirst with available:false returns null (no unavailable record)
    (prisma.cleanerAvailability.findFirst as jest.Mock).mockResolvedValue(null);
    const result = await isAvailable(tenantId, cleanerId, date);
    expect(result).toBe(true);
  });
});

// ── setAvailability unit tests ─────────────────────────────────────────────

describe('setAvailability', () => {
  test('throws 404 if cleaner not found in tenant', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      setAvailability(tenantId, cleanerId, { date, available: false }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.cleanerAvailability.upsert).not.toHaveBeenCalled();
  });

  test('upserts record when cleaner exists', async () => {
    const mockCleaner = { id: cleanerId };
    const mockRecord = { id: 'av-1', tenantId, cleanerId, date, available: false, note: null };
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner);
    (prisma.cleanerAvailability.upsert as jest.Mock).mockResolvedValue(mockRecord);

    const result = await setAvailability(tenantId, cleanerId, { date, available: false });
    expect(result).toEqual(mockRecord);
    expect(prisma.cleanerAvailability.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cleanerId_date: { cleanerId, date } },
        create: expect.objectContaining({ tenantId, cleanerId, available: false }),
        update: expect.objectContaining({ available: false }),
      }),
    );
  });
});

// ── getAvailability unit tests ─────────────────────────────────────────────

describe('getAvailability', () => {
  test('filters by tenantId and date range', async () => {
    const from = new Date('2026-07-01T00:00:00.000Z');
    const to = new Date('2026-07-31T00:00:00.000Z');
    const mockRecords = [
      { id: 'av-1', tenantId, cleanerId, date: new Date('2026-07-10'), available: false },
    ];
    (prisma.cleanerAvailability.findMany as jest.Mock).mockResolvedValue(mockRecords);

    const result = await getAvailability(tenantId, cleanerId, from, to);
    expect(result).toEqual(mockRecords);
    expect(prisma.cleanerAvailability.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          cleanerId,
          date: { gte: from, lte: to },
        }),
      }),
    );
  });
});

// ── HTTP endpoint tests ────────────────────────────────────────────────────

describe('GET /availability/:cleanerId', () => {
  const from = '2026-07-01T00:00:00.000Z';
  const to = '2026-07-31T00:00:00.000Z';

  test('COORDINATOR can view any cleaner → 200', async () => {
    (prisma.cleanerAvailability.findMany as jest.Mock).mockResolvedValue([]);
    const res = await request(app)
      .get(`/availability/${cleanerId}?from=${from}&to=${to}`)
      .set('Authorization', makeToken('COORDINATOR'));
    expect(res.status).toBe(200);
  });

  test('ADM can view any cleaner → 200', async () => {
    (prisma.cleanerAvailability.findMany as jest.Mock).mockResolvedValue([]);
    const res = await request(app)
      .get(`/availability/${cleanerId}?from=${from}&to=${to}`)
      .set('Authorization', makeToken('ADM'));
    expect(res.status).toBe(200);
  });

  test('CLEANER can view own availability → 200', async () => {
    (prisma.cleanerAvailability.findMany as jest.Mock).mockResolvedValue([]);
    const res = await request(app)
      .get(`/availability/${cleanerId}?from=${from}&to=${to}`)
      .set('Authorization', makeToken('CLEANER', cleanerId));
    expect(res.status).toBe(200);
  });

  test('CLEANER cannot view another cleaner → 403', async () => {
    const res = await request(app)
      .get(`/availability/other-cleaner?from=${from}&to=${to}`)
      .set('Authorization', makeToken('CLEANER', cleanerId));
    expect(res.status).toBe(403);
  });

  test('unauthenticated → 401', async () => {
    const res = await request(app)
      .get(`/availability/${cleanerId}?from=${from}&to=${to}`);
    expect(res.status).toBe(401);
  });
});

describe('PUT /availability/:cleanerId/:date', () => {
  const dateStr = '2026-07-15T00:00:00.000Z';

  test('CLEANER sets own availability → 200', async () => {
    const mockCleaner = { id: cleanerId };
    const mockRecord = { id: 'av-1', tenantId, cleanerId, date: new Date(dateStr), available: false };
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner);
    (prisma.cleanerAvailability.upsert as jest.Mock).mockResolvedValue(mockRecord);

    const res = await request(app)
      .put(`/availability/${cleanerId}/${dateStr}`)
      .set('Authorization', makeToken('CLEANER', cleanerId))
      .send({ available: false });
    expect(res.status).toBe(200);
  });

  test('CLEANER cannot set availability for another cleaner → 403', async () => {
    const res = await request(app)
      .put(`/availability/other-cleaner/${dateStr}`)
      .set('Authorization', makeToken('CLEANER', cleanerId))
      .send({ available: false });
    expect(res.status).toBe(403);
  });

  test('ADM can set availability for any cleaner → 200', async () => {
    const mockCleaner = { id: cleanerId };
    const mockRecord = { id: 'av-1', tenantId, cleanerId, date: new Date(dateStr), available: true };
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleaner);
    (prisma.cleanerAvailability.upsert as jest.Mock).mockResolvedValue(mockRecord);

    const res = await request(app)
      .put(`/availability/${cleanerId}/${dateStr}`)
      .set('Authorization', makeToken('ADM'))
      .send({ available: true, note: 'Back from vacation' });
    expect(res.status).toBe(200);
  });

  test('cleaner not found → 404', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await request(app)
      .put(`/availability/${cleanerId}/${dateStr}`)
      .set('Authorization', makeToken('ADM'))
      .send({ available: false });
    expect(res.status).toBe(404);
  });

  test('COORDINATOR cannot PUT → 403', async () => {
    const res = await request(app)
      .put(`/availability/${cleanerId}/${dateStr}`)
      .set('Authorization', makeToken('COORDINATOR'))
      .send({ available: false });
    expect(res.status).toBe(403);
  });
});
