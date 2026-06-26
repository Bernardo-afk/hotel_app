import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import * as svc from './tenants.service';

export const tenantsRouter = Router();
const guard = [authMiddleware, tenantMiddleware, requireRole('SUPER_ADMIN')];
const body = z.object({ name: z.string().min(1), slug: z.string().min(1) });

tenantsRouter.get('/', ...guard, async (_req, res, next) => {
  try { res.json(await svc.list()); } catch (e) { next(e); }
});
tenantsRouter.post('/', ...guard, async (req, res, next) => {
  try { res.status(201).json(await svc.create(body.parse(req.body))); } catch (e) { next(e); }
});
tenantsRouter.patch('/:id', ...guard, async (req, res, next) => {
  try { res.json(await svc.update(req.params.id, body.partial().parse(req.body))); } catch (e) { next(e); }
});
tenantsRouter.delete('/:id', ...guard, async (req, res, next) => {
  try { await svc.remove(req.params.id); res.sendStatus(204); } catch (e) { next(e); }
});
