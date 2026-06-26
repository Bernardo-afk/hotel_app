import { UrgencyLevel } from '@prisma/client';

export function computeUrgency(checkOutAt: Date, now: Date = new Date()): UrgencyLevel {
  const diffHours = (checkOutAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHours < 3) return 'RED';
  if (diffHours < 8) return 'YELLOW';
  return 'GREEN';
}
