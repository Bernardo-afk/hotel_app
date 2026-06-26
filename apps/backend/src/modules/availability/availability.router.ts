import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import { AppError } from '../../errors/AppError';
import * as svc from './availability.service';

export const availabilityRouter = Router();
const auth = [authMiddleware, tenantMiddleware];

// GET /availability/:cleanerId?from=&to=
// COORDINATOR, ADM, MANAGER, SUPER_ADMIN can view any cleaner
// CLEANER can only view their own
availabilityRouter.get(
  '/:cleanerId',
  ...auth,
  requireRole('CLEANER', 'COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { cleanerId } = req.params;

      // CLEANER can only view their own
      if (req.user.role === 'CLEANER' && cleanerId !== req.user.id) {
        return next(new AppError('Forbidden', 403));
      }

      const schema = z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
      });
      const { from, to } = schema.parse(req.query);

      const data = await svc.getAvailability(
        req.tenantId,
        cleanerId,
        new Date(from),
        new Date(to),
      );
      return res.json(data);
    } catch (e) {
      return next(e);
    }
  },
);

// PUT /availability/:cleanerId/:date
// CLEANER sets own availability only
// ADM, MANAGER, SUPER_ADMIN can set for any cleaner in tenant
availabilityRouter.put(
  '/:cleanerId/:date',
  ...auth,
  requireRole('CLEANER', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { cleanerId, date } = req.params;

      // CLEANER can only set their own availability
      if (req.user.role === 'CLEANER' && cleanerId !== req.user.id) {
        return next(new AppError('Forbidden', 403));
      }

      const body = z
        .object({
          available: z.boolean(),
          note: z.string().optional(),
        })
        .parse(req.body);

      const result = await svc.setAvailability(req.tenantId, cleanerId, {
        date: new Date(date),
        available: body.available,
        note: body.note,
      });
      return res.json(result);
    } catch (e) {
      return next(e);
    }
  },
);
