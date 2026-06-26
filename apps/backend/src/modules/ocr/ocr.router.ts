import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/role-guard';
import { AppError } from '../../errors/AppError';
import { extractAmount } from './ocr.service';

export const ocrRouter = Router();

const auth = [authMiddleware, tenantMiddleware];

const extractSchema = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.string().min(1),
});

ocrRouter.post(
  '/extract',
  ...auth,
  requireRole('CLEANER', 'ADM', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const parse = extractSchema.safeParse(req.body);
      if (!parse.success) throw new AppError('Invalid request body', 400);
      const { imageBase64, mediaType } = parse.data;
      const result = await extractAmount(imageBase64, mediaType);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);
