import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import * as svc from './dashboard.service';

export const dashboardRouter = Router();

const auth = [authMiddleware, tenantMiddleware] as const;

dashboardRouter.get(
  '/',
  ...auth,
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const filters = {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      };
      res.json(await svc.getDashboardStats(req.tenantId, filters));
    } catch (e) {
      next(e);
    }
  },
);

dashboardRouter.get(
  '/coordinator',
  ...auth,
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.getCoordinatorDashboard(req.tenantId));
    } catch (e) {
      next(e);
    }
  },
);

dashboardRouter.get(
  '/export-pdf',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const filters = {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      };
      const { buffer, filename } = await svc.exportPdf(req.tenantId, filters);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  },
);

dashboardRouter.get(
  '/adm',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.getAdmDashboard(req.tenantId));
    } catch (e) {
      next(e);
    }
  },
);

dashboardRouter.get(
  '/adm/coordinator/:id',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.getAdmCoordinatorPanel(req.tenantId, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

dashboardRouter.get(
  '/adm/alert-strip',
  ...auth,
  requireRole('ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(await svc.getAlertStrip(req.tenantId));
    } catch (e) {
      next(e);
    }
  },
);
