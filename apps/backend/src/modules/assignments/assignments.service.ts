import { JobEventType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { haversineKm } from '../../lib/haversine';
import { isAvailable } from '../availability/availability.service';
import { validateTransition } from '../cleaning-jobs/job-status-machine';
import { sendPush } from '../notifications/notifications.service';

export async function suggestCleaner(tenantId: string, jobId: string) {
  const job = await prisma.cleaningJob.findFirst({
    where: { id: jobId, tenantId },
    include: { property: { include: { condominium: true } } },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (job.property.status === 'BLOCKED') throw new AppError('Property is blocked', 422);

  const cleaners = await prisma.user.findMany({
    where: { tenantId, role: 'CLEANER', isActive: true },
  });
  const scheduledDate = new Date(job.scheduledDate);

  const ranked = await Promise.all(
    cleaners.map(async (c) => {
      const available = await isAvailable(tenantId, c.id, scheduledDate);
      const activeJobs = await prisma.cleaningAssignment.count({
        where: { tenantId, cleanerId: c.id, status: { in: ['IN_PROGRESS', 'NOTIFIED'] } },
      });
      const condoLat = Number(job.property.condominium.latitude);
      const condoLng = Number(job.property.condominium.longitude);
      // Use property location as proxy for distance (cleaner's live location unavailable)
      const distanceKm = haversineKm(condoLat, condoLng, condoLat, condoLng);
      return { cleaner: c, available, activeJobs, distanceKm };
    }),
  );

  return ranked
    .filter((r) => r.available)
    .sort((a, b) => a.activeJobs - b.activeJobs || a.distanceKm - b.distanceKm);
}

export async function assignCleaner(
  tenantId: string,
  jobId: string,
  cleanerId: string,
  isJoint = false,
  actorId: string,
) {
  const job = await prisma.cleaningJob.findFirst({
    where: { id: jobId, tenantId },
    include: { property: true },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (job.property.status === 'BLOCKED') throw new AppError('Property is blocked', 422);
  validateTransition(job.status, 'ASSIGNED');

  const cleaner = await prisma.user.findFirst({
    where: { id: cleanerId, tenantId, role: 'CLEANER', isActive: true },
  });
  if (!cleaner) throw new AppError('Cleaner not found', 404);

  const available = await isAvailable(tenantId, cleanerId, new Date(job.scheduledDate));
  if (!available) throw new AppError('Cleaner not available', 422);

  const result = await prisma.$transaction(async (tx) => {
    const assignment = await tx.cleaningAssignment.create({
      data: { tenantId, jobId, cleanerId, isJoint, status: 'NOTIFIED' },
    });
    await tx.cleaningJob.updateMany({
      where: { id: jobId, tenantId },
      data: { status: 'ASSIGNED' },
    });
    await tx.jobEventLog.create({
      data: { tenantId, jobId, eventType: 'ASSIGNED' as unknown as JobEventType, actorId },
    });
    return assignment;
  });

  if (cleaner.fcmToken) {
    await sendPush(cleaner.fcmToken, 'Nova limpeza atribuída!', `Job ${jobId}`, { jobId });
  }
  return result;
}

export async function listAssignments(
  tenantId: string,
  filters?: { jobId?: string; cleanerId?: string },
) {
  return prisma.cleaningAssignment.findMany({
    where: {
      tenantId,
      ...(filters?.jobId ? { jobId: filters.jobId } : {}),
      ...(filters?.cleanerId ? { cleanerId: filters.cleanerId } : {}),
    },
    include: { job: true },
  });
}

export async function removeAssignment(tenantId: string, id: string, actorId: string) {
  const assignment = await prisma.cleaningAssignment.findFirst({ where: { id, tenantId } });
  if (!assignment) throw new AppError('Assignment not found', 404);

  await prisma.$transaction(async (tx) => {
    await tx.cleaningAssignment.deleteMany({ where: { id, tenantId } });
    await tx.cleaningJob.updateMany({
      where: { id: assignment.jobId, tenantId },
      data: { status: 'PENDING' },
    });
    await tx.jobEventLog.create({
      data: {
        tenantId,
        jobId: assignment.jobId,
        eventType: 'PENDING' as unknown as JobEventType,
        actorId,
      },
    });
  });
  return { deleted: true };
}

export async function doorKnocked(tenantId: string, assignmentId: string) {
  const a = await prisma.cleaningAssignment.findFirst({ where: { id: assignmentId, tenantId } });
  if (!a) throw new AppError('Assignment not found', 404);
  await prisma.cleaningAssignment.updateMany({
    where: { id: assignmentId, tenantId },
    data: { doorKnockedAt: new Date() },
  });
  return prisma.cleaningAssignment.findFirst({ where: { id: assignmentId, tenantId } });
}

export async function startCleaning(tenantId: string, assignmentId: string, actorId: string) {
  const a = await prisma.cleaningAssignment.findFirst({
    where: { id: assignmentId, tenantId },
    include: { job: true },
  });
  if (!a) throw new AppError('Assignment not found', 404);
  validateTransition(a.job.status, 'IN_PROGRESS');

  return prisma.$transaction(async (tx) => {
    await tx.cleaningAssignment.updateMany({
      where: { id: assignmentId, tenantId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
    await tx.cleaningJob.updateMany({
      where: { id: a.jobId, tenantId },
      data: { status: 'IN_PROGRESS' },
    });
    await tx.jobEventLog.create({
      data: {
        tenantId,
        jobId: a.jobId,
        eventType: 'IN_PROGRESS' as unknown as JobEventType,
        actorId,
      },
    });
    return tx.cleaningAssignment.findFirst({ where: { id: assignmentId, tenantId } });
  });
}

export async function guestPresent(tenantId: string, assignmentId: string) {
  const a = await prisma.cleaningAssignment.findFirst({
    where: { id: assignmentId, tenantId },
    include: { job: { include: { property: true } } },
  });
  if (!a) throw new AppError('Assignment not found', 404);

  const coordinators = await prisma.user.findMany({
    where: { tenantId, role: 'COORDINATOR', isActive: true },
  });
  for (const coord of coordinators) {
    if (coord.fcmToken) {
      await sendPush(
        coord.fcmToken,
        'Hóspede presente!',
        `Apto ${a.job.property.unitNumber}`,
        { assignmentId },
      );
    }
  }
  await prisma.jobEventLog.create({
    data: {
      tenantId,
      jobId: a.jobId,
      eventType: 'GUEST_PRESENT' as unknown as JobEventType,
      actorId: '',
    },
  });
  return { notified: coordinators.length };
}

export async function reorderCleanerQueue(
  tenantId: string,
  cleanerId: string,
  orderedJobIds: string[],
  actorId: string,
) {
  // 1. Validate cleaner exists in tenant
  const cleaner = await prisma.user.findFirst({
    where: { id: cleanerId, tenantId, role: 'CLEANER' },
  });
  if (!cleaner) throw new AppError('Cleaner not found', 404);

  // 2. Validate all job IDs exist in tenant
  const jobs = await prisma.cleaningJob.findMany({
    where: { id: { in: orderedJobIds }, tenantId },
    include: { property: { include: { condominium: true } } },
  });
  if (jobs.length !== orderedJobIds.length) {
    throw new AppError('One or more job IDs not found in tenant', 422);
  }

  // Build ordered sequence preserving requested order (not DB return order)
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const orderedJobs = orderedJobIds.map((id) => jobMap.get(id)!);

  // 3. Store order via $transaction
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedJobIds.length; i++) {
      await tx.cleaningAssignment.updateMany({
        where: { jobId: orderedJobIds[i], cleanerId, tenantId },
        data: { sortOrder: i },
      });
    }
  });

  // 4. Recalculate estimated_cost_brl: sum haversine distances between consecutive condominiums * R$1.80/km
  let totalKm = 0;
  for (let i = 0; i < orderedJobs.length - 1; i++) {
    const a = orderedJobs[i];
    const b = orderedJobs[i + 1];
    totalKm += haversineKm(
      Number(a.property.condominium.latitude),
      Number(a.property.condominium.longitude),
      Number(b.property.condominium.latitude),
      Number(b.property.condominium.longitude),
    );
  }
  const estimated_cost_brl = Math.round(totalKm * 1.8 * 100) / 100;

  // 5. Warnings: flag RED jobs that appear after any GREEN job
  const warnings: string[] = [];
  let seenGreen = false;
  for (const job of orderedJobs) {
    if (job.urgencyLevel === 'GREEN') {
      seenGreen = true;
    } else if (job.urgencyLevel === 'RED' && seenGreen) {
      warnings.push(
        `Atenção: apt ${job.property.unitNumber} (URGENTE) ficará após apts menos urgentes`,
      );
    }
  }

  // 6. Push FCM after transaction (no-op if no fcmToken)
  if (cleaner.fcmToken) {
    await sendPush(cleaner.fcmToken, 'STAY', 'Sua rota foi atualizada', { type: 'route_updated' });
  }

  return { ordered_job_ids: orderedJobIds, estimated_cost_brl, warnings };
}

export async function cantFinish(tenantId: string, assignmentId: string, actorId: string) {
  const a = await prisma.cleaningAssignment.findFirst({
    where: { id: assignmentId, tenantId },
    include: { job: true },
  });
  if (!a) throw new AppError('Assignment not found', 404);
  validateTransition(a.job.status, 'PARTIAL');

  return prisma.$transaction(async (tx) => {
    await tx.cleaningAssignment.updateMany({
      where: { id: assignmentId, tenantId },
      data: { status: 'PARTIAL' },
    });
    await tx.cleaningJob.updateMany({
      where: { id: a.jobId, tenantId },
      data: { status: 'PARTIAL' },
    });
    await tx.jobEventLog.create({
      data: {
        tenantId,
        jobId: a.jobId,
        eventType: 'PARTIAL' as unknown as JobEventType,
        actorId,
      },
    });
    return tx.cleaningAssignment.findFirst({ where: { id: assignmentId, tenantId } });
  });
}
