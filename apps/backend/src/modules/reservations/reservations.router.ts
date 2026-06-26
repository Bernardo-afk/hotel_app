import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import * as svc from './reservations.service';

export const reservationsRouter = Router();
const auth = [authMiddleware, tenantMiddleware] as const;

reservationsRouter.get(
  '/',
  ...auth,
  requireRole('ADM', 'COORDINATOR', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { propertyId, status, checkInFrom, checkInTo } = req.query as Record<string, string>;
      const filters: svc.ListFilters = {};
      if (propertyId) filters.propertyId = propertyId;
      if (status) filters.status = status as svc.ListFilters['status'];
      if (checkInFrom) filters.checkInFrom = new Date(checkInFrom);
      if (checkInTo) filters.checkInTo = new Date(checkInTo);
      res.json(await svc.listReservations(req.tenantId, filters));
    } catch (e) {
      next(e);
    }
  },
);

reservationsRouter.get(
  '/:id',
  ...auth,
  requireRole('ADM', 'COORDINATOR', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.getReservation(req.tenantId, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

reservationsRouter.post(
  '/',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const b = z
        .object({
          propertyId: z.string(),
          checkIn: z.string(),
          checkOut: z.string(),
          guestName: z.string().optional(),
        })
        .parse(req.body);
      res.status(201).json(await svc.createReservation(req.tenantId, b));
    } catch (e) {
      next(e);
    }
  },
);

reservationsRouter.patch(
  '/:id',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const b = z
        .object({
          checkIn: z.string().optional(),
          checkOut: z.string().optional(),
          guestName: z.string().optional(),
          status: z.enum(['UPCOMING', 'ACTIVE', 'CHECKED_OUT', 'CANCELLED']).optional(),
        })
        .parse(req.body);
      res.json(await svc.updateReservation(req.tenantId, req.params.id, b));
    } catch (e) {
      next(e);
    }
  },
);

reservationsRouter.patch(
  '/:id/cancel',
  ...auth,
  requireRole('ADM', 'MANAGER', 'COORDINATOR', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.cancelReservation(req.tenantId, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);
