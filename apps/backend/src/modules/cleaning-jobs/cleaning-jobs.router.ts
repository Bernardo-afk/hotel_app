import { Router } from 'express';
import { z } from 'zod';
import { CleaningJobStatus } from '@prisma/client';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import * as svc from './cleaning-jobs.service';

export const cleaningJobsRouter = Router();

const auth = [authMiddleware, tenantMiddleware];

cleaningJobsRouter.get(
  '/',
  ...auth,
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN', 'CLEANER'),
  async (req, res, next) => {
    try {
      const { urgency, status, propertyId } = req.query as {
        urgency?: string;
        status?: string;
        propertyId?: string;
      };
      const jobs = await svc.listJobs(req.tenantId, {
        urgency: urgency as svc.ListFilters['urgency'],
        status: status as svc.ListFilters['status'],
        propertyId,
        cleanerId: req.user.role === 'CLEANER' ? req.user.id : undefined,
      });
      res.json(jobs);
    } catch (e) {
      next(e);
    }
  },
);

cleaningJobsRouter.get(
  '/:id',
  ...auth,
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN', 'CLEANER'),
  async (req, res, next) => {
    try {
      const job = await svc.getJob(req.tenantId, req.params.id);
      res.json(job);
    } catch (e) {
      next(e);
    }
  },
);

cleaningJobsRouter.post(
  '/',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          propertyId: z.string(),
          reservationId: z.string().optional(),
          scheduledDate: z.string(),
        })
        .parse(req.body);
      const job = await svc.createJob(req.tenantId, {
        ...body,
        scheduledDate: new Date(body.scheduledDate),
      });
      res.status(201).json(job);
    } catch (e) {
      next(e);
    }
  },
);

cleaningJobsRouter.patch(
  '/:id/status',
  ...auth,
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { status } = z
        .object({ status: z.nativeEnum(CleaningJobStatus) })
        .parse(req.body);
      const job = await svc.transitionJob(req.tenantId, req.params.id, status, req.user.id);
      res.json(job);
    } catch (e) {
      next(e);
    }
  },
);
