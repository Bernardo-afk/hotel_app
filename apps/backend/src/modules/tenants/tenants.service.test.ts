import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';

// Mock prisma so tests run without a real database
jest.mock('../../lib/prisma', () => ({
  prisma: {
    tenant: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const app = createApp();

const superAdminToken = () =>
  'Bearer ' +
  jwt.sign(
    { id: 'sa1', tenantId: '', role: 'SUPER_ADMIN' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );

const coordinatorToken = () =>
  'Bearer ' +
  jwt.sign(
    { id: 'c1', tenantId: 't1', role: 'COORDINATOR' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxxx';
  jest.clearAllMocks();
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: 'test-tenant' } } });
});

test('non-SUPER_ADMIN → 403', async () => {
  const res = await request(app).get('/tenants').set('Authorization', coordinatorToken());
  expect(res.status).toBe(403);
});

test('GET /tenants returns list', async () => {
  (prisma.tenant.findMany as jest.Mock).mockResolvedValue([]);
  const res = await request(app).get('/tenants').set('Authorization', superAdminToken());
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('POST /tenants creates tenant', async () => {
  const tenant = { id: 'tenant-1', name: 'Test Tenant', slug: 'test-tenant-1', createdAt: new Date(), updatedAt: new Date() };
  (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.tenant.create as jest.Mock).mockResolvedValue(tenant);

  const res = await request(app)
    .post('/tenants')
    .set('Authorization', superAdminToken())
    .send({ name: 'Test Tenant', slug: 'test-tenant-1' });

  expect(res.status).toBe(201);
  expect(res.body.slug).toBe('test-tenant-1');
});

test('duplicate slug → 409', async () => {
  const existing = { id: 'tenant-dup', name: 'Dup', slug: 'test-tenant-dup' };
  (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(existing);

  const res = await request(app)
    .post('/tenants')
    .set('Authorization', superAdminToken())
    .send({ name: 'Dup2', slug: 'test-tenant-dup' });

  expect(res.status).toBe(409);
});

test('PATCH /tenants/:id updates tenant', async () => {
  const updated = { id: 'tenant-1', name: 'Updated', slug: 'test-tenant-1' };
  (prisma.tenant.update as jest.Mock).mockResolvedValue(updated);

  const res = await request(app)
    .patch('/tenants/tenant-1')
    .set('Authorization', superAdminToken())
    .send({ name: 'Updated' });

  expect(res.status).toBe(200);
  expect(res.body.name).toBe('Updated');
});

test('PATCH /tenants/:id not found → 404', async () => {
  (prisma.tenant.update as jest.Mock).mockRejectedValue(new Error('Not found'));

  const res = await request(app)
    .patch('/tenants/nonexistent')
    .set('Authorization', superAdminToken())
    .send({ name: 'X' });

  expect(res.status).toBe(404);
});

test('DELETE /tenants/:id → 204', async () => {
  (prisma.tenant.delete as jest.Mock).mockResolvedValue({});

  const res = await request(app)
    .delete('/tenants/tenant-1')
    .set('Authorization', superAdminToken());

  expect(res.status).toBe(204);
});

test('DELETE /tenants/:id not found → 404', async () => {
  (prisma.tenant.delete as jest.Mock).mockRejectedValue(new Error('Not found'));

  const res = await request(app)
    .delete('/tenants/nonexistent')
    .set('Authorization', superAdminToken());

  expect(res.status).toBe(404);
});
