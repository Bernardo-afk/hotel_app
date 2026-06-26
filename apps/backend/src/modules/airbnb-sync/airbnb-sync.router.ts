import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import { syncCondominium } from './airbnb-sync.service';

export const airbnbSyncRouter = Router();
const auth = [authMiddleware, tenantMiddleware, requireRole('ADM', 'MANAGER', 'SUPER_ADMIN')];

airbnbSyncRouter.post('/:condominiumId/trigger', ...auth, async (req, res, next) => {
  try {
    await syncCondominium(req.tenantId, req.params.condominiumId);
    res.json({ synced: true });
  } catch (e) {
    next(e);
  }
});
