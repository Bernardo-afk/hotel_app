import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import { TicketStatus } from '@prisma/client';
import * as svc from './maintenance-tickets.service';

export const maintenanceTicketsRouter = Router();
const auth = [authMiddleware, tenantMiddleware];

maintenanceTicketsRouter.post(
  '/',
  ...auth,
  requireRole('CLEANER', 'COORDINATOR', 'ADM'),
  async (req, res, next) => {
    try {
      const b = z
        .object({
          propertyId: z.string(),
          description: z.string(),
          incidentId: z.string().optional(),
        })
        .parse(req.body);
      res.status(201).json(await svc.create(req.tenantId, b));
    } catch (e) {
      next(e);
    }
  },
);

maintenanceTicketsRouter.get(
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

maintenanceTicketsRouter.patch(
  '/:id',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { status, pendingUntil } = z
        .object({
          status: z.nativeEnum(TicketStatus),
          pendingUntil: z.string().optional(),
        })
        .parse(req.body);
      res.json(
        await svc.decide(
          req.tenantId,
          req.params.id,
          status,
          pendingUntil ? new Date(pendingUntil) : undefined,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

// public webhook — no auth, verified by IP/token in production
maintenanceTicketsRouter.post('/whatsapp-response', async (req, res, next) => {
  try {
    const { from, message } = z
      .object({ from: z.string(), message: z.string() })
      .parse(req.body);
    res.json(await svc.whatsappResponse(from, message));
  } catch (e) {
    next(e);
  }
});
