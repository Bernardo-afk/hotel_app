import { prisma } from '../../lib/prisma';
import { parseIcal } from './ical.parser';

export async function syncCondominium(tenantId: string, condominiumId: string) {
  const condo = await prisma.condominium.findFirst({ where: { id: condominiumId, tenantId } });
  if (!condo?.icalUrl) return;

  const properties = await prisma.property.findMany({
    where: { tenantId, condominiumId, status: { not: 'BLOCKED' } },
  });

  const events = await parseIcal(condo.icalUrl);

  for (const event of events) {
    for (const prop of properties) {
      // match by summary containing unit number — convention: "Airbnb - Apt 101"
      if (!event.summary.includes(prop.unitNumber)) continue;

      // Instead of upsert, use find-first + create-or-update
      const existing = await prisma.reservation.findFirst({
        where: { tenantId, propertyId: prop.id, icalUid: event.uid },
      });

      if (existing) {
        await prisma.reservation.update({
          where: { id: existing.id },
          data: {
            checkIn: event.checkIn,
            checkOut: event.checkOut,
            status: event.status === 'CANCELLED' ? 'CANCELLED' : 'UPCOMING',
          },
        });
      } else {
        await prisma.reservation.create({
          data: {
            tenantId,
            propertyId: prop.id,
            icalUid: event.uid,
            guestName: event.summary,
            checkIn: event.checkIn,
            checkOut: event.checkOut,
            status: event.status === 'CANCELLED' ? 'CANCELLED' : 'UPCOMING',
          },
        });
      }
    }
  }
}

export async function syncAllTenants() {
  const condos = await prisma.condominium.findMany({ where: { icalUrl: { not: null } } });
  for (const condo of condos) {
    await syncCondominium(condo.tenantId, condo.id).catch(console.error);
  }
}
