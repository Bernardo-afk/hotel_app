import { CleaningJobStatus, JobEventType, UrgencyLevel } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { computeUrgency } from '../urgency-engine/urgency.service';
import { validateTransition } from './job-status-machine';

export interface ListFilters {
  status?: CleaningJobStatus;
  propertyId?: string;
  urgency?: UrgencyLevel;
  cleanerId?: string;
}

export async function listJobs(tenantId: string, filters: ListFilters = {}) {
  const { urgency, cleanerId, ...rest } = filters;

  const jobs = await prisma.cleaningJob.findMany({
    where: {
      tenantId,
      ...rest,
      ...(cleanerId ? { assignments: { some: { cleanerId } } } : {}),
    },
    include: {
      property: { include: { condominium: true } },
      assignments: true,
      reservation: true,
    },
    orderBy: [{ urgencyLevel: 'asc' }, { scheduledDate: 'asc' }],
  });

  return jobs.map((job) => {
    const checkOutAt = job.reservation?.checkOut ?? job.scheduledDate;
    const computedUrgency =
      job.property.status === 'BLOCKED' ? null : computeUrgency(checkOutAt);
    return { ...job, urgency: computedUrgency };
  }).filter((job) => !urgency || job.urgency === urgency);
}

export async function getJob(tenantId: string, id: string) {
  const job = await prisma.cleaningJob.findFirst({
    where: { id, tenantId },
    include: {
      property: { include: { condominium: true } },
      assignments: true,
      reservation: true,
    },
  });
  if (!job) throw new AppError('Job not found', 404);
  return job;
}

export async function createJob(
  tenantId: string,
  data: { propertyId: string; reservationId?: string; scheduledDate: Date },
) {
  const property = await prisma.property.findFirst({ where: { id: data.propertyId, tenantId } });
  if (!property) throw new AppError('Property not found', 404);
  if (property.status === 'BLOCKED') throw new AppError('Property is blocked', 422);

  const urgencyLevel = computeUrgency(data.scheduledDate);
  return prisma.cleaningJob.create({
    data: { tenantId, urgencyLevel, ...data },
  });
}

export async function transitionJob(
  tenantId: string,
  id: string,
  newStatus: CleaningJobStatus,
  actorId: string,
) {
  const job = await prisma.cleaningJob.findFirst({ where: { id, tenantId } });
  if (!job) throw new AppError('Job not found', 404);

  validateTransition(job.status, newStatus);

  return prisma.$transaction(async (tx) => {
    // Optimistic-lock: only update if status hasn't changed since we read it
    const result = await tx.cleaningJob.updateMany({
      where: { id, tenantId, status: job.status },
      data: { status: newStatus },
    });
    if (result.count === 0) throw new AppError('Concurrent status change', 409);

    await tx.jobEventLog.create({
      data: { tenantId, jobId: id, eventType: newStatus as unknown as JobEventType, actorId },
    });

    return tx.cleaningJob.findFirst({ where: { id, tenantId } });
  });
}

export async function recalcUrgency(tenantId: string) {
  const jobs = await prisma.cleaningJob.findMany({
    where: { tenantId, status: { notIn: ['DONE', 'CANCELLED', 'BLOCKED'] } },
    include: { reservation: true, property: true },
  });

  for (const job of jobs) {
    if (job.urgencyOverride || job.property.status === 'BLOCKED') continue;
    const checkOut = job.reservation?.checkOut ?? job.scheduledDate;
    const level = computeUrgency(checkOut);
    if (level !== job.urgencyLevel) {
      await prisma.cleaningJob.updateMany({
        where: { id: job.id, tenantId },
        data: { urgencyLevel: level },
      });
    }
  }
}
