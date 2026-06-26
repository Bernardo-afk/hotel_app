import cron from 'node-cron';
import { prisma } from '../../lib/prisma';
import { sendPush } from '../notifications/notifications.service';

export function register(): void {
  cron.schedule('0 20 * * *', async () => {
    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const done = await prisma.cleaningJob.count({
        where: { tenantId: t.id, status: 'DONE', scheduledDate: { gte: startOfToday } },
      });
      const pending = await prisma.cleaningJob.count({
        where: { tenantId: t.id, status: 'PENDING' },
      });
      const adms = await prisma.user.findMany({
        where: { tenantId: t.id, role: 'ADM' },
      });
      for (const adm of adms) {
        if (adm.fcmToken) {
          await sendPush(adm.fcmToken, 'Resumo do dia', `${done} concluídos, ${pending} pendentes`).catch(console.error);
        }
      }
    }
  });
}
