import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import { AppError } from '../../errors/AppError';
import * as svc from './media.service';

export const mediaRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });
const auth = [authMiddleware, tenantMiddleware];

mediaRouter.post(
  '/upload',
  ...auth,
  requireRole('CLEANER', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const jobId = req.query.jobId as string | undefined;
      if (!jobId) throw new AppError('jobId query parameter is required', 400);
      if (!req.file) throw new AppError('No file uploaded', 400);

      const result = await svc.uploadMedia(req.tenantId, jobId, {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
      });
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },
);

mediaRouter.get(
  '/:jobId',
  ...auth,
  requireRole('COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const result = await svc.listMedia(req.tenantId, req.params.jobId);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);
