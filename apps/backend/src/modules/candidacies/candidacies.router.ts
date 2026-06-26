import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import * as svc from './candidacies.service';

export const candidaciesRouter = Router();
const auth = [authMiddleware, tenantMiddleware];

candidaciesRouter.get(
  '/',
  ...auth,
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN', 'CLEANER'),
  async (req, res, next) => {
    try {
      const { jobId, status } = req.query as { jobId?: string; status?: string };
      const isCleaner = req.user.role === 'CLEANER';
      const cleanerId = isCleaner ? req.user.id : (req.query.cleanerId as string | undefined);
      res.json(await svc.listCandidacies(req.tenantId, { jobId, cleanerId, status }));
    } catch (e) {
      next(e);
    }
  },
);

candidaciesRouter.post(
  '/',
  ...auth,
  requireRole('CLEANER'),
  async (req, res, next) => {
    try {
      const { jobId } = z.object({ jobId: z.string() }).parse(req.body);
      res.status(201).json(await svc.applyCandidacy(req.tenantId, req.user.id, jobId));
    } catch (e) {
      next(e);
    }
  },
);

candidaciesRouter.patch(
  '/:id/accept',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.acceptCandidacy(req.tenantId, req.params.id, req.user.id));
    } catch (e) {
      next(e);
    }
  },
);

candidaciesRouter.patch(
  '/:id/reject',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.rejectCandidacy(req.tenantId, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);
