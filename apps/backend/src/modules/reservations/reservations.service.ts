import { ReservationStatus } from '@prisma/client';
import { AppError } from '../../errors/AppError';
import { prisma } from '../../lib/prisma';

export interface ListFilters {
  propertyId?: string;
  status?: ReservationStatus;
  checkInFrom?: Date;
  checkInTo?: Date;
}

export async function listReservations(tenantId: string, filters?: ListFilters) {
  const where: Record<string, unknown> = { tenantId };

  if (filters?.propertyId) where.propertyId = filters.propertyId;
  if (filters?.status) where.status = filters.status;

  if (filters?.checkInFrom !== undefined || filters?.checkInTo !== undefined) {
    const checkInFilter: Record<string, Date> = {};
    if (filters?.checkInFrom) checkInFilter.gte = filters.checkInFrom;
    if (filters?.checkInTo) checkInFilter.lte = filters.checkInTo;
    where.checkIn = checkInFilter;
  }

  return prisma.reservation.findMany({
    where,
    include: { property: true },
    orderBy: { checkIn: 'asc' },
  });
}

export async function getReservation(tenantId: string, id: string) {
  const reservation = await prisma.reservation.findFirst({
    where: { id, tenantId },
    include: { property: true },
  });
  if (!reservation) throw new AppError('Reservation not found', 404);
  return reservation;
}

export interface CreateReservationData {
  propertyId: string;
  checkIn: string | Date;
  checkOut: string | Date;
  guestName?: string;
}

export async function createReservation(tenantId: string, data: CreateReservationData) {
  const checkIn = new Date(data.checkIn);
  const checkOut = new Date(data.checkOut);

  const overlap = await prisma.reservation.findFirst({
    where: {
      tenantId,
      propertyId: data.propertyId,
      status: { not: 'CANCELLED' },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
  });

  if (overlap) throw new AppError('Reservation overlaps with existing booking', 409);

  return prisma.reservation.create({
    data: {
      tenantId,
      propertyId: data.propertyId,
      checkIn,
      checkOut,
      guestName: data.guestName,
    },
  });
}

export interface UpdateReservationData {
  checkIn?: string | Date;
  checkOut?: string | Date;
  guestName?: string;
  status?: ReservationStatus;
}

export async function updateReservation(
  tenantId: string,
  id: string,
  data: UpdateReservationData,
) {
  const reservation = await prisma.reservation.findFirst({ where: { id, tenantId } });
  if (!reservation) throw new AppError('Reservation not found', 404);

  const updateData: Record<string, unknown> = {};
  if (data.checkIn !== undefined) updateData.checkIn = new Date(data.checkIn);
  if (data.checkOut !== undefined) updateData.checkOut = new Date(data.checkOut);
  if (data.guestName !== undefined) updateData.guestName = data.guestName;
  if (data.status !== undefined) updateData.status = data.status;

  await prisma.reservation.updateMany({ where: { id, tenantId }, data: updateData });
  return prisma.reservation.findFirst({ where: { id, tenantId } });
}

export async function cancelReservation(tenantId: string, id: string) {
  const reservation = await prisma.reservation.findFirst({ where: { id, tenantId } });
  if (!reservation) throw new AppError('Reservation not found', 404);

  await prisma.cleaningJob.updateMany({
    where: {
      tenantId,
      reservationId: id,
      status: { in: ['PENDING', 'ASSIGNED'] },
    },
    data: { status: 'CANCELLED' },
  });

  await prisma.reservation.updateMany({
    where: { id, tenantId },
    data: { status: 'CANCELLED' },
  });
  return prisma.reservation.findFirst({ where: { id, tenantId } });
}
