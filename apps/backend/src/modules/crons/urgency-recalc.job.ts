import cron from 'node-cron';
import { prisma } from '../../lib/prisma';
import { recalcUrgency } from '../cleaning-jobs/cleaning-jobs.service';

export function register(): void {
  cron.schedule('*/15 * * * *', async () => {
    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) await recalcUrgency(t.id).catch(console.error);
  });
}
