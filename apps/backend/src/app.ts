import express from 'express';
import { errorHandler } from './errors/error-handler';
import { authRouter } from './modules/auth/auth.router';
import { tenantsRouter } from './modules/tenants/tenants.router';
import { usersRouter } from './modules/users/users.router';
import { propertiesRouter } from './modules/properties/properties.router';
import { airbnbSyncRouter } from './modules/airbnb-sync/airbnb-sync.router';
import { reservationsRouter } from './modules/reservations/reservations.router';
import { cleaningJobsRouter } from './modules/cleaning-jobs/cleaning-jobs.router';
import { availabilityRouter } from './modules/availability/availability.router';
import { assignmentsRouter } from './modules/assignments/assignments.router';
import { relocationsRouter } from './modules/relocations/relocations.router';
import { candidaciesRouter } from './modules/candidacies/candidacies.router';
import { routeSuggestionRouter } from './modules/route-suggestion/route-suggestion.router';
import { ocrRouter } from './modules/ocr/ocr.router';
import { transportRouter } from './modules/transport/transport.router';
import { reportsRouter } from './modules/reports/reports.router';

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
  app.use('/availability', availabilityRouter);
  app.use('/assignments', assignmentsRouter);
  app.use('/relocations', relocationsRouter);
  app.use('/candidacies', candidaciesRouter);
  app.use('/routes', routeSuggestionRouter);

  app.use('/ocr', ocrRouter);
  app.use('/transport', transportRouter);

  app.use('/', reportsRouter);

  // modules registered in later tasks

  app.use(errorHandler);
  return app;
}
