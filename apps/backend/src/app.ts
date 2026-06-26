import express from 'express';
import { errorHandler } from './errors/error-handler';
import { authRouter } from './modules/auth/auth.router';
import { tenantsRouter } from './modules/tenants/tenants.router';
import { usersRouter } from './modules/users/users.router';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/auth', authRouter);
  app.use('/tenants', tenantsRouter);
  app.use('/users', usersRouter);

  // modules registered in later tasks

  app.use(errorHandler);
  return app;
}
