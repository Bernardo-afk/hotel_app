import cron from 'node-cron';
import { prisma } from '../../lib/prisma';

export function register(): void {
  cron.schedule('0 0 * * *', async () => {
    await prisma.user.updateMany({
      where: { role: 'CLEANER' },
      data: { streakCount: 0 },
    });
  });
}
