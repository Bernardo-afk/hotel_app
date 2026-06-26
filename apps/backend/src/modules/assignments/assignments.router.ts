import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import * as svc from './assignments.service';

export const assignmentsRouter = Router();

const auth = [authMiddleware, tenantMiddleware];

assignmentsRouter.get(
  '/',
  ...auth,
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { jobId, cleanerId } = req.query as { jobId?: string; cleanerId?: string };
      res.json(await svc.listAssignments(req.tenantId, { jobId, cleanerId }));
    } catch (e) {
      next(e);
    }
  },
);

assignmentsRouter.post(
  '/',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { jobId, cleanerId } = z
        .object({ jobId: z.string(), cleanerId: z.string() })
        .parse(req.body);
      res.status(201).json(await svc.assignCleaner(req.tenantId, jobId, cleanerId));
    } catch (e) {
      next(e);
    }
  },
);

assignmentsRouter.delete(
  '/:id',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.removeAssignment(req.tenantId, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);
