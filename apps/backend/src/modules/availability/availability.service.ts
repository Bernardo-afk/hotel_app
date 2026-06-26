import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

export async function setAvailability(
  tenantId: string,
  cleanerId: string,
  data: { date: Date; available: boolean; note?: string },
) {
  // Verify cleaner exists and belongs to this tenant with CLEANER role
  const cleaner = await prisma.user.findFirst({
    where: { id: cleanerId, tenantId, role: 'CLEANER' },
    select: { id: true },
  });
  if (!cleaner) throw new AppError('Cleaner not found', 404);

  return prisma.cleanerAvailability.upsert({
    where: { cleanerId_date: { cleanerId, date: data.date } },
    create: {
      tenantId,
      cleanerId,
      date: data.date,
      available: data.available,
      note: data.note ?? null,
    },
    update: {
      available: data.available,
      note: data.note ?? null,
    },
  });
}

export function getAvailability(
  tenantId: string,
  cleanerId: string,
  from: Date,
  to: Date,
) {
  return prisma.cleanerAvailability.findMany({
    where: {
      tenantId,
      cleanerId,
      date: { gte: from, lte: to },
    },
    orderBy: { date: 'asc' },
  });
}

export async function isAvailable(
  tenantId: string,
  cleanerId: string,
  date: Date,
): Promise<boolean> {
  const record = await prisma.cleanerAvailability.findFirst({
    where: { tenantId, cleanerId, date, available: false },
  });
  return record === null;
}
