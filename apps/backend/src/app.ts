import express from 'express';
import { errorHandler } from './errors/error-handler';
import { authRouter } from './modules/auth/auth.router';
import { tenantsRouter } from './modules/tenants/tenants.router';
import { usersRouter } from './modules/users/users.router';
import { propertiesRouter } from './modules/properties/properties.router';
import { airbnbSyncRouter } from './modules/airbnb-sync/airbnb-sync.router';
import { reservationsRouter } from './modules/reservations/reservations.router';
import { cleaningJobsRouter } from './modules/cleaning-jobs/cleaning-jobs.router';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/auth', authRouter);
  app.use('/tenants', tenantsRouter);
  app.use('/users', usersRouter);
  app.use('/properties', propertiesRouter);
  app.use('/airbnb-sync', airbnbSyncRouter);
  app.use('/reservations', reservationsRouter);
  app.use('/cleaning-jobs', cleaningJobsRouter);

  // modules registered in later tasks

  app.use(errorHandler);
  return app;
}
