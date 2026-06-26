import cron from 'node-cron';
import { prisma } from '../../lib/prisma';
import { sendWhatsApp } from '../notifications/notifications.service';

export function register(): void {
  cron.schedule('*/5 * * * *', async () => {
    const threshold = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    const unread = await prisma.notificationLog.findMany({
      where: {
        channel: 'PUSH',
        status: 'SENT',
        openedAt: null,
        sentAt: { lt: threshold },
      },
      include: { user: true },
    });
    for (const n of unread) {
      if (n.user.whatsappNumber) {
        await sendWhatsApp(n.user.whatsappNumber, `${n.title}: ${n.body}`).catch(console.error);
        await prisma.notificationLog.update({
          where: { id: n.id },
          data: { status: 'DELIVERED' },
        });
      }
    }
  });
}
