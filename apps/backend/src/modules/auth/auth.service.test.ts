import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcryptjs';

// Mock prisma so tests run without a real database
jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

// Mock bcrypt so tests don't depend on actual hashing
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockCleanerUser = {
  id: 'user-cleaner-1',
  tenantId: 'tenant-1',
  role: 'CLEANER',
  name: 'Maria',
  phone: '11999990001',
  email: null,
  passwordHash: 'hashed-password',
  isActive: true,
};

const mockCoordinatorUser = {
  id: 'user-coord-1',
  tenantId: 'tenant-1',
  role: 'COORDINATOR',
  name: 'Ana',
  phone: '11999990002',
  email: 'ana@test.com',
  passwordHash: 'hashed-password',
  isActive: true,
};

const app = createApp();

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxxx';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars-min-xx';
  jest.clearAllMocks();
});

test('CLEANER login with phone → 200 + tokens', async () => {
  (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleanerUser);
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);

  const res = await request(app).post('/auth/login').send({
    identifier: '11999990001',
    password: 'senha123',
    tenantId: 'tenant-1',
  });

  expect(res.status).toBe(200);
  expect(res.body.accessToken).toBeDefined();
  expect(res.body.refreshToken).toBeDefined();
  expect(res.body.user.role).toBe('CLEANER');
});

test('COORDINATOR login with email → 200', async () => {
  (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCoordinatorUser);
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);

  const res = await request(app).post('/auth/login').send({
    identifier: 'ana@test.com',
    password: 'senha123',
    tenantId: 'tenant-1',
  });

  expect(res.status).toBe(200);
  expect(res.body.user.role).toBe('COORDINATOR');
});

test('wrong password → 401', async () => {
  (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleanerUser);
  (bcrypt.compare as jest.Mock).mockResolvedValue(false);

  const res = await request(app).post('/auth/login').send({
    identifier: '11999990001',
    password: 'wrong',
    tenantId: 'tenant-1',
  });

  expect(res.status).toBe(401);
});

test('refresh token → new accessToken', async () => {
  // First login to get a refresh token
  (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockCleanerUser);
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);

  const loginRes = await request(app).post('/auth/login').send({
    identifier: '11999990001',
    password: 'senha123',
    tenantId: 'tenant-1',
  });

  expect(loginRes.status).toBe(200);

  // Now use the refresh token
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockCleanerUser);

  const res = await request(app).post('/auth/refresh').send({
    refreshToken: loginRes.body.refreshToken,
  });

  expect(res.status).toBe(200);
  expect(res.body.accessToken).toBeDefined();
});
