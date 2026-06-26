import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import { completeAssignment } from './reports.service';
import { AppError } from '../../errors/AppError';

export const reportsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const auth = [authMiddleware, tenantMiddleware, requireRole('CLEANER')];

reportsRouter.post(
  '/assignments/:id/complete',
  ...auth,
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;
      if (!files?.photo?.[0]) throw new AppError('Photo is required', 400);

      const body = z
        .object({
          aptConditionFound: z.coerce.number().int().min(1).max(5),
          dirtLevel: z.coerce.number().int().min(1).max(5),
          needsService: z.coerce.boolean(),
          serviceUrgency: z.string().optional(),
        })
        .parse(req.body);

      const photo = files.photo[0];
      const video = files.video?.[0];

      const result = await completeAssignment(
        req.tenantId,
        req.params.id,
        body,
        photo.buffer,
        photo.mimetype,
        video?.buffer,
        video?.mimetype,
      );

      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },
);
