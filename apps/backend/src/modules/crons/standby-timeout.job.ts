import cron from 'node-cron';
import { prisma } from '../../lib/prisma';
import { sendPush } from '../notifications/notifications.service';

export function register(): void {
  cron.schedule('*/30 * * * *', async () => {
    const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const stale = await prisma.cleaningJob.findMany({
      where: { status: 'STAND_BY', updatedAt: { lt: threshold } },
    });
    for (const job of stale) {
      const coords = await prisma.user.findMany({
        where: { tenantId: job.tenantId, role: 'COORDINATOR' },
      });
      for (const c of coords) {
        if (c.fcmToken) {
          await sendPush(c.fcmToken, 'Stand By crítico', `Job ${job.id} em stand-by há mais de 2h`, { jobId: job.id }).catch(console.error);
        }
      }
    }
  });
}
