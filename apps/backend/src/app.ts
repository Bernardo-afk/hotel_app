import express from 'express';
import { errorHandler } from './errors/error-handler';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // modules registered in later tasks

  app.use(errorHandler);
  return app;
}
