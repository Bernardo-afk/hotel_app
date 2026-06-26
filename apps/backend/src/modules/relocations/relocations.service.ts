import { JobEventType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { validateTransition } from '../cleaning-jobs/job-status-machine';
import { sendPush } from '../notifications/notifications.service';

export async function suggestRelocation(tenantId: string, cleanerId: string) {
  const activeAssignment = await prisma.cleaningAssignment.findFirst({
    where: { tenantId, cleanerId, status: { in: ['IN_PROGRESS', 'NOTIFIED'] } },
  });

  if (!activeAssignment) return [];

  return prisma.cleaningJob.findMany({
    where: {
      tenantId,
      status: 'PENDING',
      urgencyLevel: 'RED',
      property: { status: { not: 'BLOCKED' } },
    },
    include: { property: true, assignments: true },
  });
}

export async function confirmRelocation(
  tenantId: string,
  fromJobId: string,
  toJobId: string,
  cleanerId: string,
  actorId: string,
) {
  const [fromJob, toJob] = await Promise.all([
    prisma.cleaningJob.findFirst({ where: { id: fromJobId, tenantId }, include: { property: true } }),
    prisma.cleaningJob.findFirst({ where: { id: toJobId, tenantId }, include: { property: true } }),
  ]);

  if (!fromJob) throw new AppError('Source job not found', 404);
  if (!toJob) throw new AppError('Target job not found', 404);

  if (fromJob.status === 'BLOCKED') throw new AppError('Source job is blocked', 422);
  if (toJob.status === 'BLOCKED') throw new AppError('Target job is blocked', 422);

  if (fromJob.property.status === 'BLOCKED') throw new AppError('Source property is blocked', 422);
  if (toJob.property.status === 'BLOCKED') throw new AppError('Target property is blocked', 422);

  validateTransition(fromJob.status, 'STAND_BY');
  validateTransition(toJob.status, 'ASSIGNED');

  const result = await prisma.$transaction(async (tx) => {
    await tx.cleaningJob.updateMany({
      where: { id: fromJobId, tenantId },
      data: { status: 'STAND_BY' },
    });

    const assignment = await tx.cleaningAssignment.create({
      data: { tenantId, jobId: toJobId, cleanerId, status: 'NOTIFIED' },
    });

    await tx.cleaningJob.updateMany({
      where: { id: toJobId, tenantId },
      data: { status: 'ASSIGNED' },
    });

    await tx.jobEventLog.create({
      data: {
        tenantId,
        jobId: fromJobId,
        eventType: 'STAND_BY' as unknown as JobEventType,
        actorId,
      },
    });

    await tx.jobEventLog.create({
      data: {
        tenantId,
        jobId: toJobId,
        eventType: 'RELOCATION_CONFIRMED' as unknown as JobEventType,
        actorId,
      },
    });

    return assignment;
  });

  const cleaner = await prisma.user.findFirst({ where: { id: cleanerId, tenantId } });
  if (cleaner?.fcmToken) {
    await sendPush(
      cleaner.fcmToken,
      'Realocação urgente!',
      'Você foi realocado para um novo serviço',
      { fromJobId, toJobId },
    );
  }

  return result;
}

export async function blockSimultaneous(tenantId: string, jobId: string) {
  const job = await prisma.cleaningJob.findFirst({ where: { id: jobId, tenantId } });
  if (!job) throw new AppError('Job not found', 404);

  validateTransition(job.status, 'BLOCKED');

  await prisma.cleaningJob.updateMany({
    where: { id: jobId, tenantId },
    data: { status: 'BLOCKED' },
  });

  return prisma.cleaningJob.findFirst({ where: { id: jobId, tenantId } });
}
