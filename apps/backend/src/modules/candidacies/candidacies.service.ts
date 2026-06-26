import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

export async function applyCandidacy(
  tenantId: string,
  cleanerId: string,
  jobId: string,
) {
  const job = await prisma.cleaningJob.findFirst({
    where: { id: jobId, tenantId },
    include: { property: true },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (job.property.status === 'BLOCKED') throw new AppError('Property is blocked', 422);
  if (job.status !== 'PENDING') throw new AppError('Job is not available for candidacy', 422);

  const existing = await prisma.candidacyRequest.findFirst({
    where: { tenantId, cleanerId, jobId },
  });
  if (existing) throw new AppError('Already applied to this job', 409);

  return prisma.candidacyRequest.create({
    data: { tenantId, cleanerId, jobId, status: 'PENDING' },
  });
}

export async function listCandidacies(
  tenantId: string,
  filters?: { jobId?: string; cleanerId?: string; status?: string },
) {
  return prisma.candidacyRequest.findMany({
    where: {
      tenantId,
      ...(filters?.jobId ? { jobId: filters.jobId } : {}),
      ...(filters?.cleanerId ? { cleanerId: filters.cleanerId } : {}),
      ...(filters?.status ? { status: filters.status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
    },
    include: {
      cleaner: { select: { name: true, phone: true } },
    },
  });
}

export async function acceptCandidacy(
  tenantId: string,
  candidacyId: string,
  actorId: string,
) {
  const candidacy = await prisma.candidacyRequest.findFirst({
    where: { id: candidacyId, tenantId },
  });
  if (!candidacy) throw new AppError('Candidacy not found', 404);
  if (candidacy.status !== 'PENDING') throw new AppError('Candidacy is not pending', 422);

  return prisma.$transaction(async (tx) => {
    await tx.candidacyRequest.updateMany({
      where: { id: candidacyId, tenantId },
      data: { status: 'APPROVED' },
    });

    await tx.candidacyRequest.updateMany({
      where: {
        jobId: candidacy.jobId,
        tenantId,
        status: 'PENDING',
        id: { not: candidacyId },
      },
      data: { status: 'REJECTED' },
    });

    await tx.cleaningAssignment.create({
      data: {
        tenantId,
        jobId: candidacy.jobId,
        cleanerId: candidacy.cleanerId,
        status: 'NOTIFIED',
      },
    });

    await tx.cleaningJob.updateMany({
      where: { id: candidacy.jobId, tenantId },
      data: { status: 'ASSIGNED' },
    });

    return tx.candidacyRequest.findFirst({ where: { id: candidacyId, tenantId } });
  });
}

export async function rejectCandidacy(tenantId: string, candidacyId: string) {
  await prisma.candidacyRequest.updateMany({
    where: { id: candidacyId, tenantId },
    data: { status: 'REJECTED' },
  });
  return prisma.candidacyRequest.findFirst({ where: { id: candidacyId, tenantId } });
}
