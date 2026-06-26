import { prisma } from '../../lib/prisma';

export const list = (tenantId: string) =>
  prisma.property.findMany({ where: { tenantId }, include: { condominium: true } });

export const create = (tenantId: string, data: { condominiumId: string; unitNumber: string }) =>
  prisma.property.create({ data: { tenantId, ...data } });

export const update = (tenantId: string, id: string, data: { unitNumber?: string }) =>
  prisma.property.update({ where: { id, tenantId }, data });

export async function block(tenantId: string, id: string, reason: string, blockedUntil?: Date) {
  return prisma.property.update({
    where: { id, tenantId },
    data: { status: 'BLOCKED', blockedReason: reason, blockedUntil: blockedUntil ?? null },
  });
}

export async function unblock(tenantId: string, id: string) {
  return prisma.property.update({
    where: { id, tenantId },
    data: { status: 'ACTIVE', blockedReason: null, blockedUntil: null },
  });
}
