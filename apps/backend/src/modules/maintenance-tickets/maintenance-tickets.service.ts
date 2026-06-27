import { TicketStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { sendPush } from '../notifications/notifications.service';

export async function create(
  tenantId: string,
  data: { propertyId: string; description: string; incidentId?: string },
) {
  const prop = await prisma.property.findFirst({ where: { id: data.propertyId, tenantId } });
  if (!prop) throw new AppError('Property not found', 404);
  return prisma.maintenanceTicket.create({ data: { tenantId, ...data } });
}

export const list = (tenantId: string) =>
  prisma.maintenanceTicket.findMany({ where: { tenantId }, include: { property: true } });

export async function decide(
  tenantId: string,
  id: string,
  status: TicketStatus,
  pendingUntil?: Date,
) {
  const existing = await prisma.maintenanceTicket.findFirst({ where: { id, tenantId } });
  if (!existing) throw new AppError('Ticket not found', 404);

  await prisma.maintenanceTicket.updateMany({
    where: { id, tenantId },
    data: {
      status,
      pendingUntil: pendingUntil ?? null,
      resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
    },
  });

  const ticket = await prisma.maintenanceTicket.findFirst({
    where: { id, tenantId },
    include: { property: true },
  });

  if (status === 'WONT_FIX' && ticket) {
    await prisma.property.updateMany({
      where: { id: ticket.propertyId, tenantId },
      data: { status: 'BLOCKED', blockedReason: `Ticket ${id} — WONT_FIX` },
    });

    const superAdmins = await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' } });
    const adms = await prisma.user.findMany({ where: { tenantId, role: 'ADM' } });
    for (const u of [...superAdmins, ...adms]) {
      if (u.fcmToken) {
        await sendPush(u.fcmToken, 'Apt bloqueado — WONT_FIX', `Ticket #${id}`, { ticketId: id });
      }
    }
  }

  return ticket;
}

export async function whatsappResponse(from: string, message: string) {
  const user = await prisma.user.findFirst({ where: { whatsappNumber: from } });
  if (!user) return { matched: false };
  await prisma.maintenanceTicket.updateMany({
    where: { tenantId: user.tenantId, status: 'PENDING', whatsappSentAt: { not: null } },
    data: { whatsappResponse: message },
  });
  return { matched: true };
}
