import { prisma } from '../../lib/prisma';
import { uploadToS3 } from '../../lib/s3';
import { completeAssignment } from './reports.service';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma', () => {
  const cleaningReport = { create: jest.fn() };
  const cleaningJob = { update: jest.fn() };
  const cleaningAssignment = {
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  const user = { update: jest.fn() };
  const jobEventLog = { create: jest.fn() };

  return {
    prisma: {
      cleaningAssignment,
      cleaningReport,
      cleaningJob,
      user,
      jobEventLog,
      $transaction: jest.fn().mockImplementation(
        async (fn: (tx: unknown) => unknown) =>
          fn({ cleaningReport, cleaningJob, cleaningAssignment, user, jobEventLog }),
      ),
    },
  };
});

jest.mock('../../lib/s3', () => ({
  uploadToS3: jest.fn().mockResolvedValue('https://s3.example.com/photo.jpg'),
}));

const tenantId = 'tenant-report-1';
const assignmentId = 'assign-1';
const jobId = 'job-1';
const cleanerId = 'cleaner-1';

const mockAssignment = {
  id: assignmentId,
  tenantId,
  jobId,
  cleanerId,
  status: 'IN_PROGRESS',
  job: { id: jobId, tenantId, status: 'IN_PROGRESS' },
  cleaner: { id: cleanerId, tenantId },
};

const mockReport = {
  id: 'report-1',
  tenantId,
  jobId,
  aptConditionFound: 4,
  dirtLevel: 3,
  finishPhotoUrl: 'https://s3.example.com/photo.jpg',
  finishVideoUrl: null,
  needsService: false,
  serviceUrgency: null,
  createdAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('completeAssignment', () => {
  test('creates report + increments streak + transitions job to DONE', async () => {
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(mockAssignment);
    (prisma.cleaningReport.create as jest.Mock).mockResolvedValue(mockReport);
    (prisma.cleaningJob.update as jest.Mock).mockResolvedValue({ ...mockAssignment.job, status: 'DONE' });
    (prisma.cleaningAssignment.update as jest.Mock).mockResolvedValue({ ...mockAssignment, status: 'DONE' });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: cleanerId, streakCount: 5 });
    (prisma.jobEventLog.create as jest.Mock).mockResolvedValue({});

    const photoBuffer = Buffer.from('fake-photo');

    const result = await completeAssignment(
      tenantId,
      assignmentId,
      { aptConditionFound: 4, dirtLevel: 3, needsService: false },
      photoBuffer,
      'image/jpeg',
    );

    expect(result.report).toEqual(mockReport);
    expect(result.streak).toBe(5);

    expect(uploadToS3).toHaveBeenCalledWith(
      expect.stringMatching(/^completions\//),
      photoBuffer,
      'image/jpeg',
    );
    expect(prisma.cleaningAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: assignmentId, tenantId } }),
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.cleaningReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId, jobId }),
      }),
    );
    expect(prisma.cleaningJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: jobId },
        data: { status: 'DONE' },
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: cleanerId },
        data: { streakCount: { increment: 1 } },
      }),
    );
    expect(prisma.jobEventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId,
          jobId,
          eventType: 'COMPLETED',
          actorId: cleanerId,
        }),
      }),
    );
  });

  test('throws 404 if assignment not found', async () => {
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      completeAssignment(
        tenantId,
        'nonexistent',
        { aptConditionFound: 4, dirtLevel: 3, needsService: false },
        Buffer.from('photo'),
        'image/jpeg',
      ),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Assignment not found' });

    expect(uploadToS3).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('uploadToS3 called with correct key pattern for photo', async () => {
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(mockAssignment);
    (prisma.cleaningReport.create as jest.Mock).mockResolvedValue(mockReport);
    (prisma.cleaningJob.update as jest.Mock).mockResolvedValue({});
    (prisma.cleaningAssignment.update as jest.Mock).mockResolvedValue({});
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: cleanerId, streakCount: 3 });
    (prisma.jobEventLog.create as jest.Mock).mockResolvedValue({});

    const photoBuffer = Buffer.from('photo-data');

    await completeAssignment(
      tenantId,
      assignmentId,
      { aptConditionFound: 5, dirtLevel: 2, needsService: true, serviceUrgency: 'HIGH' },
      photoBuffer,
      'image/jpeg',
    );

    expect(uploadToS3).toHaveBeenCalledTimes(1);
    const [key, buf, mime] = (uploadToS3 as jest.Mock).mock.calls[0];
    expect(key).toMatch(/^completions\//);
    expect(buf).toBe(photoBuffer);
    expect(mime).toBe('image/jpeg');
  });

  test('uploadToS3 called with correct key patterns for photo and video', async () => {
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(mockAssignment);
    (prisma.cleaningReport.create as jest.Mock).mockResolvedValue(mockReport);
    (prisma.cleaningJob.update as jest.Mock).mockResolvedValue({});
    (prisma.cleaningAssignment.update as jest.Mock).mockResolvedValue({});
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: cleanerId, streakCount: 3 });
    (prisma.jobEventLog.create as jest.Mock).mockResolvedValue({});

    const photoBuffer = Buffer.from('photo-data');
    const videoBuffer = Buffer.from('video-data');

    await completeAssignment(
      tenantId,
      assignmentId,
      { aptConditionFound: 3, dirtLevel: 4, needsService: false },
      photoBuffer,
      'image/jpeg',
      videoBuffer,
      'video/mp4',
    );

    expect(uploadToS3).toHaveBeenCalledTimes(2);
    expect(uploadToS3).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^completions\//),
      photoBuffer,
      'image/jpeg',
    );
    expect(uploadToS3).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^completions\/videos\//),
      videoBuffer,
      'video/mp4',
    );
  });

  test('throws 422 for invalid status transition', async () => {
    const doneAssignment = {
      ...mockAssignment,
      status: 'DONE',
      job: { id: jobId, tenantId, status: 'DONE' },
    };
    (prisma.cleaningAssignment.findFirst as jest.Mock).mockResolvedValue(doneAssignment);

    await expect(
      completeAssignment(
        tenantId,
        assignmentId,
        { aptConditionFound: 4, dirtLevel: 3, needsService: false },
        Buffer.from('photo'),
        'image/jpeg',
      ),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(uploadToS3).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
