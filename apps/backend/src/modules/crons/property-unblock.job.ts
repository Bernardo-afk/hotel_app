import cron from 'node-cron';
import { prisma } from '../../lib/prisma';

export function register(): void {
  cron.schedule('1 0 * * *', async () => {
    await prisma.property.updateMany({
      where: { status: 'BLOCKED', blockedUntil: { lt: new Date() } },
      data: { status: 'ACTIVE', blockedReason: null, blockedUntil: null },
    });
  });
}
