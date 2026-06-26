import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';

// Mock prisma so tests run without a real database
jest.mock('../../lib/prisma', () => ({
  prisma: {
    property: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const app = createApp();

const tenantId = 'tenant-prop-1';
const condoId = 'condo-1';
const propId = 'prop-1';

const admToken = () =>
  'Bearer ' +
  jwt.sign({ id: 'adm1', tenantId, role: 'ADM' }, process.env.JWT_SECRET!, { expiresIn: '1h' });

const mockProperty = {
  id: propId,
  tenantId,
  condominiumId: condoId,
  unitNumber: '101',
  status: 'ACTIVE',
  blockedReason: null,
  blockedUntil: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxxx';
  jest.clearAllMocks();
});

test('POST /properties → 201', async () => {
  (prisma.property.create as jest.Mock).mockResolvedValue(mockProperty);

  const res = await request(app)
    .post('/properties')
    .set('Authorization', admToken())
    .send({ condominiumId: condoId, unitNumber: '101' });

  expect(res.status).toBe(201);
  expect(res.body.status).toBe('ACTIVE');
});

test('GET /properties → 200 with array', async () => {
  (prisma.property.findMany as jest.Mock).mockResolvedValue([mockProperty]);

  const res = await request(app)
    .get('/properties')
    .set('Authorization', admToken());

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('PATCH /properties/:id/block sets BLOCKED', async () => {
  const blocked = { ...mockProperty, status: 'BLOCKED', blockedReason: 'Reforma' };
  (prisma.property.update as jest.Mock).mockResolvedValue(blocked);

  const res = await request(app)
    .patch(`/properties/${propId}/block`)
    .set('Authorization', admToken())
    .send({ reason: 'Reforma' });

  expect(res.status).toBe(200);
  expect(res.body.status).toBe('BLOCKED');
  expect(res.body.blockedReason).toBe('Reforma');
});

test('PATCH /properties/:id/unblock sets ACTIVE', async () => {
  const active = { ...mockProperty, status: 'ACTIVE', blockedReason: null, blockedUntil: null };
  (prisma.property.update as jest.Mock).mockResolvedValue(active);

  const res = await request(app)
    .patch(`/properties/${propId}/unblock`)
    .set('Authorization', admToken());

  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ACTIVE');
});

test('PATCH /properties/:id → 200', async () => {
  const updated = { ...mockProperty, unitNumber: '102' };
  (prisma.property.update as jest.Mock).mockResolvedValue(updated);

  const res = await request(app)
    .patch(`/properties/${propId}`)
    .set('Authorization', admToken())
    .send({ unitNumber: '102' });

  expect(res.status).toBe(200);
  expect(res.body.unitNumber).toBe('102');
});

test('POST /properties missing fields → 422', async () => {
  const res = await request(app)
    .post('/properties')
    .set('Authorization', admToken())
    .send({});

  expect(res.status).toBe(422);
});
