import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import * as svc from './properties.service';

export const propertiesRouter = Router();
const auth = [authMiddleware, tenantMiddleware];

propertiesRouter.get(
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

propertiesRouter.post(
  '/',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const b = z
        .object({ condominiumId: z.string(), unitNumber: z.string() })
        .parse(req.body);
      res.status(201).json(await svc.create(req.tenantId, b));
    } catch (e) {
      next(e);
    }
  },
);

propertiesRouter.patch(
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

propertiesRouter.patch(
  '/:id/block',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { reason, blockedUntil } = z
        .object({ reason: z.string(), blockedUntil: z.string().optional() })
        .parse(req.body);
      res.json(
        await svc.block(
          req.tenantId,
          req.params.id,
          reason,
          blockedUntil ? new Date(blockedUntil) : undefined,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

propertiesRouter.patch(
  '/:id/unblock',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.unblock(req.tenantId, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);
