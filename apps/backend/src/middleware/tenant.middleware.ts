import { RequestHandler } from 'express';

export const tenantMiddleware: RequestHandler = (req, _res, next) => {
  req.tenantId =
    req.user.role === 'SUPER_ADMIN'
      ? ((req.headers['x-tenant-id'] as string) ?? '')
      : req.user.tenantId;
  next();
};
