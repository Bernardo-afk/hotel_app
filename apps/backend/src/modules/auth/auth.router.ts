import { Router } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';

export const authRouter = Router();

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  tenantId: z.string().min(1),
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    res.json(await authService.login(body));
  } catch (e) { next(e); }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    res.json(await authService.refresh(refreshToken));
  } catch (e) { next(e); }
});
