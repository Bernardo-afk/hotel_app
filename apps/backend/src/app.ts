import express from 'express';
import { errorHandler } from './errors/error-handler';
import { authRouter } from './modules/auth/auth.router';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/auth', authRouter);

  // modules registered in later tasks

  app.use(errorHandler);
  return app;
}
