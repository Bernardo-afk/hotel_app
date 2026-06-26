import { prisma } from '../../lib/prisma';
import { parseIcal } from './ical.parser';

export async function syncCondominium(tenantId: string, condominiumId: string) {
  const condo = await prisma.condominium.findUnique({ where: { id: condominiumId } });
  if (!condo?.icalUrl) return;

  const properties = await prisma.property.findMany({
    where: { tenantId, condominiumId, status: { not: 'BLOCKED' } },
  });

  const events = await parseIcal(condo.icalUrl);

  for (const event of events) {
    for (const prop of properties) {
      // match by summary containing unit number — convention: "Airbnb - Apt 101"
      if (!event.summary.includes(prop.unitNumber)) continue;

      await prisma.reservation.upsert({
        where: { icalUid: event.uid } as any,
        create: {
          tenantId,
          propertyId: prop.id,
          icalUid: event.uid,
          guestName: event.summary,
          checkIn: event.checkIn,
          checkOut: event.checkOut,
          status: event.status === 'CANCELLED' ? 'CANCELLED' : 'UPCOMING',
        },
        update: {
          checkIn: event.checkIn,
          checkOut: event.checkOut,
          status: event.status === 'CANCELLED' ? 'CANCELLED' : 'UPCOMING',
        },
      });
    }
  }
}

export async function syncAllTenants() {
  const condos = await prisma.condominium.findMany({ where: { icalUrl: { not: null } } });
  for (const condo of condos) {
    await syncCondominium(condo.tenantId, condo.id).catch(console.error);
  }
}
