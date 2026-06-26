import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import { TransportType } from '@prisma/client';
import * as svc from './transport.service';

export const transportRouter = Router();
const auth = [authMiddleware, tenantMiddleware];

const createSchema = z.object({
  transportType: z.nativeEnum(TransportType),
  amount: z.number().positive(),
  receiptUrl: z.string().url().optional(),
  originName: z.string(),
  originLat: z.number(),
  originLng: z.number(),
  destinationName: z.string(),
  destinationLat: z.number(),
  destinationLng: z.number(),
  ocrRawResponse: z.object({}).passthrough().optional(),
  ocrConfidence: z.enum(['HIGH', 'LOW']).optional(),
});

transportRouter.post(
  '/',
  ...auth,
  requireRole('CLEANER', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const b = createSchema.parse(req.body);
      // CLEANER records transport for themselves; ADM+ can submit on behalf of cleaner via body
      const cleanerId =
        req.user.role === 'CLEANER' ? req.user.id : (req.body.cleanerId as string | undefined) ?? req.user.id;
      res.status(201).json(await svc.create(req.tenantId, cleanerId, b));
    } catch (e) {
      next(e);
    }
  },
);

transportRouter.get(
  '/',
  ...auth,
  requireRole('CLEANER', 'COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { cleaner_id, month } = req.query as { cleaner_id?: string; month?: string };
      // CLEANER can only see own records
      const cleanerFilter =
        req.user.role === 'CLEANER' ? req.user.id : cleaner_id;
      res.json(await svc.list(req.tenantId, cleanerFilter, month));
    } catch (e) {
      next(e);
    }
  },
);

transportRouter.patch(
  '/:id/contest',
  ...auth,
  requireRole('CLEANER'),
  async (req, res, next) => {
    try {
      await svc.contest(req.tenantId, req.user.id, req.params.id);
      res.sendStatus(204);
    } catch (e) {
      next(e);
    }
  },
);

transportRouter.patch(
  '/:id/contest-response',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { newAmount } = z.object({ newAmount: z.number().optional() }).parse(req.body);
      res.json(await svc.contestResponse(req.tenantId, req.params.id, newAmount));
    } catch (e) {
      next(e);
    }
  },
);

transportRouter.patch(
  '/reimbursement/:id/pay',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.pay(req.tenantId, req.params.id, req.user.id));
    } catch (e) {
      next(e);
    }
  },
);
