import cron from 'node-cron';
import { prisma } from '../../lib/prisma';
import { sendWhatsApp } from '../notifications/notifications.service';

export function register(): void {
  cron.schedule('*/30 * * * *', async () => {
    const threshold = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const jobs = await prisma.cleaningJob.findMany({
      where: { status: 'PENDING', createdAt: { lt: threshold } },
      include: { property: true },
    });
    for (const job of jobs) {
      const coordinators = await prisma.user.findMany({
        where: { tenantId: job.tenantId, role: 'COORDINATOR', whatsappNumber: { not: null } },
      });
      for (const c of coordinators) {
        if (c.whatsappNumber) {
          await sendWhatsApp(c.whatsappNumber, `Job ${job.id} pendente há mais de 3h.`).catch(console.error);
        }
      }
    }
  });
}
