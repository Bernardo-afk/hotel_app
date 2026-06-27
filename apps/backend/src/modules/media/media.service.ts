import { prisma } from '../../lib/prisma';
import { uploadToS3 } from '../../lib/s3';
import { AppError } from '../../errors/AppError';

export async function uploadMedia(
  tenantId: string,
  jobId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string },
): Promise<{ url: string; key: string }> {
  const job = await prisma.cleaningJob.findFirst({ where: { id: jobId, tenantId } });
  if (!job) throw new AppError('Job not found', 404);

  const key = `media/${tenantId}/${jobId}/${Date.now()}-${file.originalname}`;
  const url = await uploadToS3(key, file.buffer, file.mimetype);

  const report = await prisma.cleaningReport.findFirst({ where: { tenantId, jobId } });
  if (report) {
    await prisma.cleaningReport.update({
      where: { id: report.id },
      data: { photoUrls: { push: url } },
    });
  }

  return { url, key };
}

export async function listMedia(
  tenantId: string,
  jobId: string,
): Promise<{ photoUrls: string[] }> {
  const job = await prisma.cleaningJob.findFirst({ where: { id: jobId, tenantId } });
  if (!job) throw new AppError('Job not found', 404);

  const report = await prisma.cleaningReport.findFirst({ where: { tenantId, jobId } });
  return { photoUrls: report?.photoUrls ?? [] };
}
