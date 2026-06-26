import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import { AppError } from '../../errors/AppError';
import { suggestRoute } from './route-suggestion.service';

export const routeSuggestionRouter = Router();

const auth = [authMiddleware, tenantMiddleware];

// GET /routes/suggest?cleanerId=&date=YYYY-MM-DD
// For coordinators/admins/managers/super_admins to view any cleaner's route
routeSuggestionRouter.get(
  '/suggest',
  ...auth,
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { cleanerId, date } = req.query as { cleanerId?: string; date?: string };
      if (!cleanerId) throw new AppError('cleanerId is required', 400);

      const parsedDate = date ? new Date(date) : new Date();
      if (isNaN(parsedDate.getTime())) throw new AppError('Invalid date', 400);

      res.json(await suggestRoute(req.tenantId, cleanerId, parsedDate));
    } catch (e) {
      next(e);
    }
  },
);

// GET /routes/my?date=YYYY-MM-DD
// For cleaners to view their own route
routeSuggestionRouter.get(
  '/my',
  ...auth,
  requireRole('CLEANER'),
  async (req, res, next) => {
    try {
      const { date } = req.query as { date?: string };
      const parsedDate = date ? new Date(date) : new Date();
      if (isNaN(parsedDate.getTime())) throw new AppError('Invalid date', 400);

      res.json(await suggestRoute(req.tenantId, req.user.id, parsedDate));
    } catch (e) {
      next(e);
    }
  },
);
