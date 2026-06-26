import { TransportType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { haversineKm } from '../../lib/haversine';
import { sendPush } from '../notifications/notifications.service';

export async function create(
  tenantId: string,
  cleanerId: string,
  data: {
    transportType: TransportType;
    amount: number;
    receiptUrl?: string;
    originName: string;
    originLat: number;
    originLng: number;
    destinationName: string;
    destinationLat: number;
    destinationLng: number;
    ocrRawResponse?: object;
    ocrConfidence?: 'HIGH' | 'LOW';
  },
) {
  if (data.originName === data.destinationName) {
    throw new AppError('Origin and destination must differ', 422);
  }

  const distanceKm = haversineKm(
    data.originLat,
    data.originLng,
    data.destinationLat,
    data.destinationLng,
  );
  const monthRef = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  return prisma.$transaction(async (tx) => {
    let reimbursement = await tx.reimbursementPeriod.findUnique({
      where: { tenantId_cleanerId_monthRef: { tenantId, cleanerId, monthRef } },
    });
    if (!reimbursement) {
      reimbursement = await tx.reimbursementPeriod.create({
        data: { tenantId, cleanerId, monthRef },
      });
    }

    const record = await tx.transportRecord.create({
      data: {
        tenantId,
        cleanerId,
        transportType: data.transportType,
        amount: new Decimal(data.amount),
        receiptUrl: data.receiptUrl,
        originName: data.originName,
        originLat: new Decimal(data.originLat),
        originLng: new Decimal(data.originLng),
        destinationName: data.destinationName,
        destinationLat: new Decimal(data.destinationLat),
        destinationLng: new Decimal(data.destinationLng),
        distanceKm: new Decimal(distanceKm),
        monthRef,
        reimbursementId: reimbursement.id,
        ocrRawResponse: data.ocrRawResponse as object | undefined,
        ocrConfidence: data.ocrConfidence,
        amountSource: data.ocrConfidence === 'HIGH' ? 'OCR_AUTO' : 'ADM_MANUAL',
        status: data.ocrConfidence === 'HIGH' ? 'OK' : 'PENDING_REVIEW',
      },
    });

    await tx.reimbursementPeriod.update({
      where: { id: reimbursement.id },
      data: {
        totalAmount: { increment: data.amount },
        ridesCount: { increment: 1 },
      },
    });

    return record;
  });
}

export const list = (tenantId: string, cleanerId?: string, month?: string) =>
  prisma.transportRecord.findMany({
    where: {
      tenantId,
      ...(cleanerId ? { cleanerId } : {}),
      ...(month ? { monthRef: month } : {}),
    },
    include: { cleaner: { select: { name: true } } },
  });

export async function contest(tenantId: string, cleanerId: string, id: string) {
  const record = await prisma.transportRecord.findFirst({ where: { id, tenantId, cleanerId } });
  if (!record) throw new AppError('Not found', 404);

  await prisma.transportRecord.updateMany({
    where: { id, tenantId },
    data: { status: 'CONTESTED' },
  });

  const adms = await prisma.user.findMany({ where: { tenantId, role: 'ADM' } });
  for (const adm of adms) {
    if (adm.fcmToken) {
      await sendPush(adm.fcmToken, 'Corrida contestada', `Corrida #${id}`, { recordId: id });
    }
  }
}

export async function contestResponse(
  tenantId: string,
  id: string,
  newAmount?: number,
) {
  const record = await prisma.transportRecord.findFirst({ where: { id, tenantId } });
  if (!record) throw new AppError('Not found', 404);

  await prisma.transportRecord.updateMany({
    where: { id, tenantId },
    data: {
      status: 'CONTEST_RESOLVED',
      ...(newAmount !== undefined
        ? { amount: new Decimal(newAmount), amountSource: 'ADM_MANUAL' }
        : {}),
    },
  });

  return prisma.transportRecord.findFirst({ where: { id, tenantId } });
}

export async function pay(tenantId: string, reimbursementId: string, paidById: string) {
  const r = await prisma.reimbursementPeriod.findFirst({ where: { id: reimbursementId, tenantId } });
  if (!r) throw new AppError('Reimbursement not found', 404);

  await prisma.reimbursementPeriod.updateMany({
    where: { id: reimbursementId, tenantId },
    data: { status: 'PAID', paidById, paidAt: new Date() },
  });

  const updated = await prisma.reimbursementPeriod.findFirst({
    where: { id: reimbursementId, tenantId },
  });

  const cleaner = await prisma.user.findFirst({ where: { id: r.cleanerId, tenantId } });
  if (cleaner?.fcmToken) {
    await sendPush(
      cleaner.fcmToken,
      'Reembolso pago!',
      `R$${r.totalAmount} creditado`,
      { reimbursementId },
    );
  }

  return updated;
}
