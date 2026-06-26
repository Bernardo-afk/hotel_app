import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import * as svc from './users.service';

export const usersRouter = Router();
const auth = [authMiddleware, tenantMiddleware];

usersRouter.get(
  '/',
  ...auth,
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.list(req.tenantId));
    } catch (e) {
      next(e);
    }
  },
);

usersRouter.post(
  '/',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          name: z.string(),
          phone: z.string(),
          email: z.string().email().optional(),
          role: z.enum(['COORDINATOR', 'CLEANER', 'ADM']),
          cpf: z.string().optional(),
          rg: z.string().optional(),
          password: z.string().min(6),
        })
        .parse(req.body);
      res.status(201).json(await svc.create(req.tenantId, body));
    } catch (e) {
      next(e);
    }
  },
);

usersRouter.patch(
  '/:id',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.update(req.tenantId, req.params.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

usersRouter.delete(
  '/:id',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      await svc.deactivate(req.tenantId, req.params.id);
      res.sendStatus(204);
    } catch (e) {
      next(e);
    }
  },
);

usersRouter.post(
  '/invite-tokens',
  ...auth,
  requireRole('COORDINATOR', 'ADM'),
  async (req, res, next) => {
    try {
      res.status(201).json(await svc.createInviteToken(req.tenantId, req.user.id));
    } catch (e) {
      next(e);
    }
  },
);

usersRouter.post('/register-with-token', async (req, res, next) => {
  try {
    const body = z
      .object({
        token: z.string(),
        name: z.string(),
        phone: z.string(),
        cpf: z.string(),
        rg: z.string(),
        password: z.string().min(1),
        avatarUrl: z.string().url().optional(),
      })
      .parse(req.body);
    res.status(201).json(await svc.registerWithToken(body));
  } catch (e) {
    next(e);
  }
});
