import { RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../errors/AppError';

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) return next(new AppError('Forbidden', 403));
    next();
  };
}
