import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { IncidentType } from '@prisma/client';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import { createIncident, listIncidents } from './incidents.service';

export const incidentsRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });
const auth = [authMiddleware, tenantMiddleware];

incidentsRouter.post(
  '/',
  ...auth,
  requireRole('CLEANER', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  upload.single('photo'),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          jobId: z.string(),
          type: z.nativeEnum(IncidentType),
          description: z.string().min(1),
        })
        .parse(req.body);

      const result = await createIncident(
        req.tenantId,
        body,
        req.file?.buffer,
        req.file?.mimetype,
      );
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },
);

incidentsRouter.get(
  '/',
  ...auth,
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const jobId = req.query.jobId as string | undefined;
      res.json(await listIncidents(req.tenantId, jobId));
    } catch (e) {
      next(e);
    }
  },
);
