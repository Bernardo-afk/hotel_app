import { uploadMedia, listMedia } from './media.service';
import { prisma } from '../../lib/prisma';
import { uploadToS3 } from '../../lib/s3';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    cleaningJob: {
      findFirst: jest.fn(),
    },
    cleaningReport: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../lib/s3', () => ({
  uploadToS3: jest.fn(),
}));

const tenantId = 'tenant-1';
const jobId = 'job-1';
const mockJob = { id: jobId, tenantId };

beforeEach(() => {
  jest.clearAllMocks();
});

// ── uploadMedia ──────────────────────────────────────────────────────────────

describe('uploadMedia', () => {
  const file = {
    buffer: Buffer.from('fake-image'),
    mimetype: 'image/jpeg',
    originalname: 'photo.jpg',
  };

  test('calls uploadToS3 with correct key pattern', async () => {
    const url = 'https://bucket.s3.region.amazonaws.com/media/tenant-1/job-1/123-photo.jpg';
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (uploadToS3 as jest.Mock).mockResolvedValue(url);
    (prisma.cleaningReport.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await uploadMedia(tenantId, jobId, file);

    expect(uploadToS3).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^media/${tenantId}/${jobId}/\\d+-photo\\.jpg$`)),
      file.buffer,
      file.mimetype,
    );
    expect(result.url).toBe(url);
    expect(result.key).toMatch(new RegExp(`^media/${tenantId}/${jobId}/\\d+-photo\\.jpg$`));
  });

  test('throws 404 if job not found', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(uploadMedia(tenantId, jobId, file)).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(uploadToS3).not.toHaveBeenCalled();
  });

  test('appends url to report photoUrls when report exists', async () => {
    const url = 'https://bucket.s3.amazonaws.com/media/tenant-1/job-1/1-photo.jpg';
    const mockReport = { id: 'report-1', tenantId, jobId, photoUrls: [] };
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (uploadToS3 as jest.Mock).mockResolvedValue(url);
    (prisma.cleaningReport.findFirst as jest.Mock).mockResolvedValue(mockReport);
    (prisma.cleaningReport.update as jest.Mock).mockResolvedValue({ ...mockReport, photoUrls: [url] });

    await uploadMedia(tenantId, jobId, file);

    expect(prisma.cleaningReport.update).toHaveBeenCalledWith({
      where: { id: mockReport.id },
      data: { photoUrls: { push: url } },
    });
  });

  test('does not update report when no report exists', async () => {
    const url = 'https://bucket.s3.amazonaws.com/media/tenant-1/job-1/1-photo.jpg';
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (uploadToS3 as jest.Mock).mockResolvedValue(url);
    (prisma.cleaningReport.findFirst as jest.Mock).mockResolvedValue(null);

    await uploadMedia(tenantId, jobId, file);

    expect(prisma.cleaningReport.update).not.toHaveBeenCalled();
  });
});

// ── listMedia ────────────────────────────────────────────────────────────────

describe('listMedia', () => {
  test('returns empty photoUrls when no report exists', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (prisma.cleaningReport.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await listMedia(tenantId, jobId);

    expect(result).toEqual({ photoUrls: [] });
  });

  test('returns photoUrls from report when it exists', async () => {
    const photoUrls = ['https://bucket.s3.amazonaws.com/media/t/j/1-a.jpg', 'https://bucket.s3.amazonaws.com/media/t/j/2-b.jpg'];
    const mockReport = { id: 'report-1', tenantId, jobId, photoUrls };
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (prisma.cleaningReport.findFirst as jest.Mock).mockResolvedValue(mockReport);

    const result = await listMedia(tenantId, jobId);

    expect(result).toEqual({ photoUrls });
    expect(prisma.cleaningReport.findFirst).toHaveBeenCalledWith({
      where: { tenantId, jobId },
    });
  });

  test('throws 404 if job not found', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(listMedia(tenantId, jobId)).rejects.toMatchObject({ statusCode: 404 });
  });
});
