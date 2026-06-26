import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import * as svc from './relocations.service';

export const relocationsRouter = Router();
const auth = [authMiddleware, tenantMiddleware];

relocationsRouter.get(
  '/suggest/:cleanerId',
  ...auth,
  requireRole('ADM', 'COORDINATOR', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.suggestRelocation(req.tenantId, req.params.cleanerId));
    } catch (e) {
      next(e);
    }
  },
);

relocationsRouter.post(
  '/confirm',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { fromJobId, toJobId, cleanerId } = z
        .object({ fromJobId: z.string(), toJobId: z.string(), cleanerId: z.string() })
        .parse(req.body);
      res.json(
        await svc.confirmRelocation(req.tenantId, fromJobId, toJobId, cleanerId, req.user.id),
      );
    } catch (e) {
      next(e);
    }
  },
);

relocationsRouter.post(
  '/block/:jobId',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.blockSimultaneous(req.tenantId, req.params.jobId));
    } catch (e) {
      next(e);
    }
  },
);
