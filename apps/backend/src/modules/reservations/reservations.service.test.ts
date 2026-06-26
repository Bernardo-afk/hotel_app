import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    reservation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    cleaningJob: {
      updateMany: jest.fn(),
    },
  },
}));

const app = createApp();

const tenantId = 'tenant-res-1';
const propId = 'prop-res-1';
const resId = 'res-id-1';

const admToken = () =>
  'Bearer ' +
  jwt.sign({ id: 'adm1', tenantId, role: 'ADM' }, process.env.JWT_SECRET!, { expiresIn: '1h' });

const coordToken = () =>
  'Bearer ' +
  jwt.sign({ id: 'coord1', tenantId, role: 'COORDINATOR' }, process.env.JWT_SECRET!, {
    expiresIn: '1h',
  });

const mockReservation = {
  id: resId,
  tenantId,
  propertyId: propId,
  guestName: 'Test Guest',
  checkIn: new Date('2026-07-10T12:00:00Z'),
  checkOut: new Date('2026-07-14T11:00:00Z'),
  status: 'UPCOMING',
  icalUid: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  property: { id: propId, tenantId, unitNumber: '201' },
};

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxxx';
  jest.clearAllMocks();
});

test('GET /reservations filters by tenantId', async () => {
  (prisma.reservation.findMany as jest.Mock).mockResolvedValue([mockReservation]);

  const res = await request(app).get('/reservations').set('Authorization', admToken());

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(prisma.reservation.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ tenantId }),
    }),
  );
});

test('GET /reservations is accessible to COORDINATOR', async () => {
  (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);

  const res = await request(app).get('/reservations').set('Authorization', coordToken());

  expect(res.status).toBe(200);
});

test('GET /reservations/:id returns reservation', async () => {
  (prisma.reservation.findFirst as jest.Mock).mockResolvedValue(mockReservation);

  const res = await request(app).get(`/reservations/${resId}`).set('Authorization', admToken());

  expect(res.status).toBe(200);
  expect(res.body.id).toBe(resId);
});

test('GET /reservations/:id throws 404 if not found', async () => {
  (prisma.reservation.findFirst as jest.Mock).mockResolvedValue(null);

  const res = await request(app)
    .get('/reservations/nonexistent-id')
    .set('Authorization', admToken());

  expect(res.status).toBe(404);
});

test('POST /reservations creates reservation → 201', async () => {
  // No overlap
  (prisma.reservation.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.reservation.create as jest.Mock).mockResolvedValue(mockReservation);

  const res = await request(app)
    .post('/reservations')
    .set('Authorization', admToken())
    .send({
      propertyId: propId,
      checkIn: '2026-07-10T12:00:00Z',
      checkOut: '2026-07-14T11:00:00Z',
      guestName: 'Test Guest',
    });

  expect(res.status).toBe(201);
  expect(prisma.reservation.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ tenantId, propertyId: propId }),
    }),
  );
});

test('POST /reservations throws 409 on overlap', async () => {
  // Return an existing overlapping reservation
  (prisma.reservation.findFirst as jest.Mock).mockResolvedValue(mockReservation);

  const res = await request(app)
    .post('/reservations')
    .set('Authorization', admToken())
    .send({
      propertyId: propId,
      checkIn: '2026-07-11T12:00:00Z',
      checkOut: '2026-07-13T11:00:00Z',
    });

  expect(res.status).toBe(409);
  expect(prisma.reservation.create).not.toHaveBeenCalled();
});

test('POST /reservations missing fields → 422', async () => {
  const res = await request(app)
    .post('/reservations')
    .set('Authorization', admToken())
    .send({ propertyId: propId });

  expect(res.status).toBe(422);
});

test('PATCH /reservations/:id updates reservation', async () => {
  const updated = { ...mockReservation, guestName: 'New Guest' };
  (prisma.reservation.findFirst as jest.Mock)
    .mockResolvedValueOnce(mockReservation)
    .mockResolvedValueOnce(updated);
  (prisma.reservation.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

  const res = await request(app)
    .patch(`/reservations/${resId}`)
    .set('Authorization', admToken())
    .send({ guestName: 'New Guest' });

  expect(res.status).toBe(200);
});

test('PATCH /reservations/:id/cancel cancels reservation and cascades to CleaningJobs', async () => {
  const cancelled = { ...mockReservation, status: 'CANCELLED' };
  (prisma.reservation.findFirst as jest.Mock)
    .mockResolvedValueOnce(mockReservation)
    .mockResolvedValueOnce(cancelled);
  (prisma.cleaningJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  (prisma.reservation.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

  const res = await request(app)
    .patch(`/reservations/${resId}/cancel`)
    .set('Authorization', admToken());

  expect(res.status).toBe(200);
  expect(res.body.status).toBe('CANCELLED');

  expect(prisma.cleaningJob.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        tenantId,
        reservationId: resId,
        status: { in: ['PENDING', 'ASSIGNED'] },
      }),
      data: { status: 'CANCELLED' },
    }),
  );
});

test('PATCH /reservations/:id/cancel → 404 if not found', async () => {
  (prisma.reservation.findFirst as jest.Mock).mockResolvedValue(null);

  const res = await request(app)
    .patch('/reservations/nonexistent-id/cancel')
    .set('Authorization', admToken());

  expect(res.status).toBe(404);
});
