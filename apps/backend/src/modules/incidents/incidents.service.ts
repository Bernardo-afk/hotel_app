import { IncidentType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { uploadToS3 } from '../../lib/s3';
import { sendPush } from '../notifications/notifications.service';

export async function createIncident(
  tenantId: string,
  data: { jobId: string; type: IncidentType; description: string },
  photoBuffer?: Buffer,
  photoMime?: string,
) {
  const job = await prisma.cleaningJob.findFirst({ where: { id: data.jobId, tenantId } });
  if (!job) throw new AppError('Job not found', 404);

  const photoUrl =
    photoBuffer && photoMime
      ? await uploadToS3(
          `incidents/${crypto.randomUUID()}`,
          photoBuffer,
          photoMime,
        )
      : undefined;

  const incident = await prisma.cleaningIncident.create({
    data: {
      tenantId,
      jobId: data.jobId,
      type: data.type,
      description: data.description,
      photoUrl,
    },
  });

  if (data.type === 'LOST_ITEM') {
    const coordinators = await prisma.user.findMany({
      where: { tenantId, role: 'COORDINATOR' },
    });
    for (const c of coordinators) {
      if (c.fcmToken) {
        await sendPush(c.fcmToken, 'Item perdido reportado', data.description, {
          incidentId: incident.id,
        });
      }
    }
  }

  return incident;
}

export function listIncidents(tenantId: string, jobId?: string) {
  return prisma.cleaningIncident.findMany({
    where: {
      tenantId,
      ...(jobId ? { jobId } : {}),
    },
  });
}
