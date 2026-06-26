import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcryptjs';

// Mock prisma so tests run without a real database
jest.mock('../../lib/prisma', () => ({
  prisma: {
    inviteToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock bcrypt so tests don't depend on actual hashing
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

const app = createApp();

const tenantId = 'tenant-test-1';
const coordinatorId = 'user-coord-1';

const coordToken = () =>
  'Bearer ' +
  jwt.sign({ id: coordinatorId, tenantId, role: 'COORDINATOR' }, process.env.JWT_SECRET!, {
    expiresIn: '1h',
  });

const mockInviteRecord = {
  id: 'invite-id-1',
  token: 'test-token-abc123',
  tenantId,
  createdById: coordinatorId,
  inviteLink: '',
  role: 'CLEANER' as const,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  usedAt: null,
  usedById: null,
};

const mockUser = {
  id: 'user-cleaner-1',
  tenantId,
  role: 'CLEANER',
  name: 'Cleaner Test',
  phone: '11900000099',
  cpf: '12345678901',
  rg: '1234567',
  passwordHash: 'hashed-password',
  isActive: true,
};

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxxx';
  process.env.APP_BASE_URL = 'http://localhost:3000';
  jest.clearAllMocks();
});

test('POST /users/invite-tokens creates link', async () => {
  (prisma.inviteToken.create as jest.Mock).mockResolvedValue(mockInviteRecord);
  (prisma.inviteToken.update as jest.Mock).mockResolvedValue({
    ...mockInviteRecord,
    inviteLink: `http://localhost:3000/register?token=${mockInviteRecord.token}`,
  });

  const res = await request(app)
    .post('/users/invite-tokens')
    .set('Authorization', coordToken())
    .send({});

  expect(res.status).toBe(201);
  expect(res.body.inviteLink).toContain('/register?token=');
});

test('POST /users/register-with-token creates CLEANER', async () => {
  (prisma.inviteToken.findUnique as jest.Mock).mockResolvedValue(mockInviteRecord);
  (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const txMock = {
      user: { create: jest.fn().mockResolvedValue(mockUser) },
      inviteToken: { update: jest.fn().mockResolvedValue({}) },
    };
    return fn(txMock);
  });
  (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

  const res = await request(app).post('/users/register-with-token').send({
    token: 'test-token-abc123',
    name: 'Cleaner Test',
    phone: '11900000099',
    cpf: '12345678901',
    rg: '1234567',
    password: 'senha123',
  });

  expect(res.status).toBe(201);
  expect(res.body.accessToken).toBeDefined();
});

test('used token → 400', async () => {
  const usedInvite = { ...mockInviteRecord, usedAt: new Date() };
  (prisma.inviteToken.findUnique as jest.Mock).mockResolvedValue(usedInvite);

  const res = await request(app).post('/users/register-with-token').send({
    token: 'test-token-abc123',
    name: 'B',
    phone: '11900000011',
    cpf: '22222222222',
    rg: '222222',
    password: 'password123',
  });

  expect(res.status).toBe(400);
});
