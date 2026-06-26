import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './auth.middleware';
import { tenantMiddleware } from './tenant.middleware';
import { requireRole } from './role-guard';

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.get(
    '/protected',
    authMiddleware,
    tenantMiddleware,
    requireRole('COORDINATOR', 'ADM'),
    (req, res) => res.json({ userId: req.user.id, tenantId: req.tenantId }),
  );
  return app;
};

const secret = 'test-secret-32-chars-minimum-xxxxx';
const makeToken = (payload: object) => jwt.sign(payload, secret, { expiresIn: '1h' });

beforeEach(() => { process.env.JWT_SECRET = secret; });

test('no token → 401', async () => {
  const res = await request(makeApp()).get('/protected');
  expect(res.status).toBe(401);
});

test('bad token → 401', async () => {
  const res = await request(makeApp()).get('/protected').set('Authorization', 'Bearer bad');
  expect(res.status).toBe(401);
});

test('wrong role → 403', async () => {
  const token = makeToken({ id: 'u1', tenantId: 't1', role: 'CLEANER' });
  const res = await request(makeApp()).get('/protected').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(403);
});

test('valid token + allowed role → 200', async () => {
  const token = makeToken({ id: 'u1', tenantId: 't1', role: 'COORDINATOR' });
  const res = await request(makeApp()).get('/protected').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ userId: 'u1', tenantId: 't1' });
});
