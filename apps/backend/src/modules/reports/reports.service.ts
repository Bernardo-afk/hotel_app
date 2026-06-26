import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { uploadToS3 } from '../../lib/s3';
import { validateTransition } from '../cleaning-jobs/job-status-machine';

export async function completeAssignment(
  tenantId: string,
  assignmentId: string,
  data: {
    aptConditionFound: number;
    dirtLevel: number;
    needsService: boolean;
    serviceUrgency?: string;
  },
  photoBuffer: Buffer,
  photoMime: string,
  videoBuffer?: Buffer,
  videoMime?: string,
) {
  const assignment = await prisma.cleaningAssignment.findFirst({
    where: { id: assignmentId, tenantId },
    include: { job: true, cleaner: true },
  });
  if (!assignment) throw new AppError('Assignment not found', 404);

  validateTransition(assignment.job.status, 'DONE');

  const photoUrl = await uploadToS3(
    `completions/${randomUUID()}`,
    photoBuffer,
    photoMime,
  );

  const videoUrl =
    videoBuffer && videoMime
      ? await uploadToS3(`completions/videos/${randomUUID()}`, videoBuffer, videoMime)
      : undefined;

  return prisma.$transaction(async (tx) => {
    const report = await tx.cleaningReport.create({
      data: {
        tenantId,
        jobId: assignment.jobId,
        aptConditionFound: data.aptConditionFound,
        dirtLevel: data.dirtLevel,
        finishPhotoUrl: photoUrl,
        finishVideoUrl: videoUrl,
        needsService: data.needsService,
        serviceUrgency: data.serviceUrgency,
      },
    });

    await tx.cleaningJob.update({
      where: { id: assignment.jobId },
      data: { status: 'DONE' },
    });

    await tx.cleaningAssignment.update({
      where: { id: assignmentId },
      data: { status: 'DONE', completedAt: new Date() },
    });

    const updatedCleaner = await tx.user.update({
      where: { id: assignment.cleanerId },
      data: { streakCount: { increment: 1 } },
    });

    await tx.jobEventLog.create({
      data: {
        tenantId,
        jobId: assignment.jobId,
        eventType: 'COMPLETED',
        actorId: assignment.cleanerId,
      },
    });

    return { report, streak: updatedCleaner.streakCount };
  });
}
