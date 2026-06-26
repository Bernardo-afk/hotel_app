import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import * as svc from './assignments.service';

export const assignmentsRouter = Router();
const auth = [authMiddleware, tenantMiddleware];

assignmentsRouter.get(
  '/suggest/:jobId',
  ...auth,
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.suggestCleaner(req.tenantId, req.params.jobId));
    } catch (e) {
      next(e);
    }
  },
);

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
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const b = z
        .object({ jobId: z.string(), cleanerId: z.string(), isJoint: z.boolean().optional() })
        .parse(req.body);
      res
        .status(201)
        .json(await svc.assignCleaner(req.tenantId, b.jobId, b.cleanerId, b.isJoint, req.user.id));
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
      res.json(await svc.removeAssignment(req.tenantId, req.params.id, req.user.id));
    } catch (e) {
      next(e);
    }
  },
);

assignmentsRouter.post(
  '/:id/door-knocked',
  ...auth,
  requireRole('CLEANER'),
  async (req, res, next) => {
    try {
      res.json(await svc.doorKnocked(req.tenantId, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

assignmentsRouter.post(
  '/:id/start',
  ...auth,
  requireRole('CLEANER'),
  async (req, res, next) => {
    try {
      res.json(await svc.startCleaning(req.tenantId, req.params.id, req.user.id));
    } catch (e) {
      next(e);
    }
  },
);

assignmentsRouter.post(
  '/:id/guest-present',
  ...auth,
  requireRole('CLEANER'),
  async (req, res, next) => {
    try {
      res.json(await svc.guestPresent(req.tenantId, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

assignmentsRouter.post(
  '/:id/cant-finish',
  ...auth,
  requireRole('CLEANER'),
  async (req, res, next) => {
    try {
      res.json(await svc.cantFinish(req.tenantId, req.params.id, req.user.id));
    } catch (e) {
      next(e);
    }
  },
);
