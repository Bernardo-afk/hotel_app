import { createIncident, listIncidents } from './incidents.service';
import { prisma } from '../../lib/prisma';
import { uploadToS3 } from '../../lib/s3';
import { sendPush } from '../notifications/notifications.service';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    cleaningJob: {
      findFirst: jest.fn(),
    },
    cleaningIncident: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../lib/s3', () => ({
  uploadToS3: jest.fn(),
}));

jest.mock('../notifications/notifications.service', () => ({
  sendPush: jest.fn(),
}));

const tenantId = 'tenant-1';
const jobId = 'job-1';

const mockJob = { id: jobId, tenantId };

const mockIncident = {
  id: 'incident-1',
  tenantId,
  jobId,
  type: 'BROKEN' as const,
  description: 'Broken window',
  photoUrl: null,
  createdAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ── createIncident ──────────────────────────────────────────────────────────

describe('createIncident', () => {
  test('creates incident with correct data', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (prisma.cleaningIncident.create as jest.Mock).mockResolvedValue(mockIncident);

    const result = await createIncident(tenantId, {
      jobId,
      type: 'BROKEN',
      description: 'Broken window',
    });

    expect(result).toEqual(mockIncident);
    expect(prisma.cleaningIncident.create).toHaveBeenCalledWith({
      data: {
        tenantId,
        jobId,
        type: 'BROKEN',
        description: 'Broken window',
        photoUrl: undefined,
      },
    });
  });

  test('throws 404 if job not found', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      createIncident(tenantId, { jobId, type: 'BROKEN', description: 'test' }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(prisma.cleaningIncident.create).not.toHaveBeenCalled();
  });

  test('uploads photo to S3 when buffer provided', async () => {
    const photoUrl = 'https://bucket.s3.region.amazonaws.com/incidents/uuid';
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (uploadToS3 as jest.Mock).mockResolvedValue(photoUrl);
    (prisma.cleaningIncident.create as jest.Mock).mockResolvedValue({
      ...mockIncident,
      photoUrl,
    });

    const buffer = Buffer.from('fake-image');
    await createIncident(
      tenantId,
      { jobId, type: 'STAINED', description: 'Stained carpet' },
      buffer,
      'image/jpeg',
    );

    expect(uploadToS3).toHaveBeenCalledWith(
      expect.stringMatching(/^incidents\//),
      buffer,
      'image/jpeg',
    );
    expect(prisma.cleaningIncident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ photoUrl }),
      }),
    );
  });

  test('notifies coordinators via sendPush when type is LOST_ITEM', async () => {
    const coordinator1 = { id: 'coord-1', fcmToken: 'token-1', role: 'COORDINATOR' };
    const coordinator2 = { id: 'coord-2', fcmToken: null, role: 'COORDINATOR' };
    const lostItemIncident = { ...mockIncident, type: 'LOST_ITEM' as const, description: 'Lost wallet' };

    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (prisma.cleaningIncident.create as jest.Mock).mockResolvedValue(lostItemIncident);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([coordinator1, coordinator2]);
    (sendPush as jest.Mock).mockResolvedValue(undefined);

    await createIncident(tenantId, { jobId, type: 'LOST_ITEM', description: 'Lost wallet' });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { tenantId, role: 'COORDINATOR' },
    });
    // Only coordinator with fcmToken receives push
    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(sendPush).toHaveBeenCalledWith(
      'token-1',
      'Item perdido reportado',
      'Lost wallet',
      { incidentId: lostItemIncident.id },
    );
  });

  test('does not notify coordinators for non-LOST_ITEM types', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    (prisma.cleaningIncident.create as jest.Mock).mockResolvedValue(mockIncident);

    await createIncident(tenantId, { jobId, type: 'BROKEN', description: 'Broken door' });

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });
});

// ── listIncidents ────────────────────────────────────────────────────────────

describe('listIncidents', () => {
  test('filters by tenantId', async () => {
    const mockList = [mockIncident];
    (prisma.cleaningIncident.findMany as jest.Mock).mockResolvedValue(mockList);

    const result = await listIncidents(tenantId);

    expect(result).toEqual(mockList);
    expect(prisma.cleaningIncident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
  });

  test('filters by jobId when provided', async () => {
    (prisma.cleaningIncident.findMany as jest.Mock).mockResolvedValue([]);

    await listIncidents(tenantId, jobId);

    expect(prisma.cleaningIncident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, jobId }),
      }),
    );
  });

  test('does not include jobId filter when not provided', async () => {
    (prisma.cleaningIncident.findMany as jest.Mock).mockResolvedValue([]);

    await listIncidents(tenantId);

    expect(prisma.cleaningIncident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId },
      }),
    );
  });
});
