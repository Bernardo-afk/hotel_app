import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { isAvailable } from '../availability/availability.service';
import { transitionJob } from '../cleaning-jobs/cleaning-jobs.service';

export async function assignCleaner(tenantId: string, jobId: string, cleanerId: string) {
  const job = await prisma.cleaningJob.findFirst({
    where: { id: jobId, tenantId },
    include: { property: { include: { condominium: true } } },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (job.property.status === 'BLOCKED') throw new AppError('Property is blocked', 422);

  const available = await isAvailable(tenantId, cleanerId, job.scheduledDate);
  if (!available) throw new AppError('Cleaner not available', 422);

  const assignment = await prisma.cleaningAssignment.create({
    data: { tenantId, jobId, cleanerId },
  });

  await transitionJob(tenantId, jobId, 'ASSIGNED', cleanerId);

  return assignment;
}

export async function listAssignments(
  tenantId: string,
  filters?: { jobId?: string; cleanerId?: string },
) {
  return prisma.cleaningAssignment.findMany({
    where: { tenantId, ...filters },
  });
}

export async function removeAssignment(tenantId: string, id: string) {
  const assignment = await prisma.cleaningAssignment.findFirst({ where: { id, tenantId } });
  if (!assignment) throw new AppError('Assignment not found', 404);

  await prisma.cleaningAssignment.deleteMany({ where: { id, tenantId } });
  await transitionJob(tenantId, assignment.jobId, 'PENDING', 'system');

  return { deleted: true };
}
