import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { validateTransition } from './job-status-machine';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma', () => {
  const cleaningJob = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const jobEventLog = {
    create: jest.fn(),
  };
  return {
    prisma: {
      cleaningJob,
      property: { findFirst: jest.fn() },
      jobEventLog,
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn({ cleaningJob, jobEventLog }),
      ),
    },
  };
});

const app = createApp();

const tenantId = 'tenant-cj-1';
const propId = 'prop-cj-1';
const jobId = 'job-cj-1';

const admToken = () =>
  'Bearer ' +
  jwt.sign({ id: 'adm1', tenantId, role: 'ADM' }, process.env.JWT_SECRET!, { expiresIn: '1h' });

const coordToken = () =>
  'Bearer ' +
  jwt.sign({ id: 'coord1', tenantId, role: 'COORDINATOR' }, process.env.JWT_SECRET!, {
    expiresIn: '1h',
  });

const mockProperty = {
  id: propId,
  tenantId,
  status: 'ACTIVE',
  condominium: {},
};

const mockJob = {
  id: jobId,
  tenantId,
  propertyId: propId,
  status: 'PENDING',
  urgencyLevel: 'GREEN',
  urgencyOverride: false,
  scheduledDate: new Date('2026-07-01T10:00:00Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  property: { ...mockProperty, status: 'ACTIVE' },
  assignments: [],
  reservation: null,
};

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxxx';
  jest.clearAllMocks();
});

// ── Status machine unit tests ──────────────────────────────────────────────

describe('validateTransition', () => {
  test('PENDING → ASSIGNED is valid', () => {
    expect(() => validateTransition('PENDING', 'ASSIGNED')).not.toThrow();
  });

  test('PENDING → DONE is invalid → throws AppError 422', () => {
    expect(() => validateTransition('PENDING', 'DONE')).toThrow(AppError);
    try {
      validateTransition('PENDING', 'DONE');
    } catch (e: unknown) {
      expect((e as AppError).statusCode).toBe(422);
    }
  });

  test('PENDING → CANCELLED is valid', () => {
    expect(() => validateTransition('PENDING', 'CANCELLED')).not.toThrow();
  });

  test('PENDING → BLOCKED is valid', () => {
    expect(() => validateTransition('PENDING', 'BLOCKED')).not.toThrow();
  });

  test('ASSIGNED → IN_PROGRESS is valid', () => {
    expect(() => validateTransition('ASSIGNED', 'IN_PROGRESS')).not.toThrow();
  });

  test('ASSIGNED → PENDING is valid', () => {
    expect(() => validateTransition('ASSIGNED', 'PENDING')).not.toThrow();
  });

  test('IN_PROGRESS → STAND_BY is valid', () => {
    expect(() => validateTransition('IN_PROGRESS', 'STAND_BY')).not.toThrow();
  });

  test('IN_PROGRESS → PARTIAL is valid', () => {
    expect(() => validateTransition('IN_PROGRESS', 'PARTIAL')).not.toThrow();
  });

  test('IN_PROGRESS → DONE is valid', () => {
    expect(() => validateTransition('IN_PROGRESS', 'DONE')).not.toThrow();
  });

  test('PARTIAL → IN_PROGRESS is valid', () => {
    expect(() => validateTransition('PARTIAL', 'IN_PROGRESS')).not.toThrow();
  });

  test('DONE → IN_PROGRESS is invalid → throws', () => {
    expect(() => validateTransition('DONE', 'IN_PROGRESS')).toThrow(AppError);
  });

  test('DONE → CANCELLED is invalid → throws', () => {
    expect(() => validateTransition('DONE', 'CANCELLED')).toThrow(AppError);
  });

  test('CANCELLED → PENDING is invalid → throws', () => {
    expect(() => validateTransition('CANCELLED', 'PENDING')).toThrow(AppError);
  });

  test('BLOCKED → CANCELLED is valid', () => {
    expect(() => validateTransition('BLOCKED', 'CANCELLED')).not.toThrow();
  });

  test('BLOCKED → PENDING is invalid → throws 422', () => {
    expect(() => validateTransition('BLOCKED', 'PENDING')).toThrow(AppError);
    try {
      validateTransition('BLOCKED', 'PENDING');
    } catch (e: unknown) {
      expect((e as AppError).statusCode).toBe(422);
    }
  });
});

// ── HTTP endpoint tests ────────────────────────────────────────────────────

describe('GET /cleaning-jobs', () => {
  test('filters by tenantId → 200', async () => {
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([mockJob]);

    const res = await request(app)
      .get('/cleaning-jobs')
      .set('Authorization', admToken());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(prisma.cleaningJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
  });

  test('COORDINATOR can access → 200', async () => {
    (prisma.cleaningJob.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/cleaning-jobs')
      .set('Authorization', coordToken());

    expect(res.status).toBe(200);
  });

  test('unauthenticated → 401', async () => {
    const res = await request(app).get('/cleaning-jobs');
    expect(res.status).toBe(401);
  });
});

describe('GET /cleaning-jobs/:id', () => {
  test('returns job when found → 200', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);

    const res = await request(app)
      .get(`/cleaning-jobs/${jobId}`)
      .set('Authorization', admToken());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(jobId);
  });

  test('throws 404 when not found', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/cleaning-jobs/nonexistent')
      .set('Authorization', admToken());

    expect(res.status).toBe(404);
  });
});

describe('POST /cleaning-jobs', () => {
  test('creates job with valid property → 201', async () => {
    (prisma.property.findFirst as jest.Mock).mockResolvedValue(mockProperty);
    (prisma.cleaningJob.create as jest.Mock).mockResolvedValue(mockJob);

    const res = await request(app)
      .post('/cleaning-jobs')
      .set('Authorization', admToken())
      .send({
        propertyId: propId,
        scheduledDate: '2026-07-01T10:00:00Z',
      });

    expect(res.status).toBe(201);
    expect(prisma.cleaningJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId, propertyId: propId }),
      }),
    );
  });

  test('throws 422 when property is BLOCKED', async () => {
    (prisma.property.findFirst as jest.Mock).mockResolvedValue({
      ...mockProperty,
      status: 'BLOCKED',
    });

    const res = await request(app)
      .post('/cleaning-jobs')
      .set('Authorization', admToken())
      .send({
        propertyId: propId,
        scheduledDate: '2026-07-01T10:00:00Z',
      });

    expect(res.status).toBe(422);
    expect(prisma.cleaningJob.create).not.toHaveBeenCalled();
  });

  test('throws 404 when property not found', async () => {
    (prisma.property.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .post('/cleaning-jobs')
      .set('Authorization', admToken())
      .send({
        propertyId: 'nonexistent',
        scheduledDate: '2026-07-01T10:00:00Z',
      });

    expect(res.status).toBe(404);
  });

  test('missing fields → 422', async () => {
    const res = await request(app)
      .post('/cleaning-jobs')
      .set('Authorization', admToken())
      .send({});

    expect(res.status).toBe(422);
  });

  test('COORDINATOR cannot create job → 403', async () => {
    const res = await request(app)
      .post('/cleaning-jobs')
      .set('Authorization', coordToken())
      .send({ propertyId: propId, scheduledDate: '2026-07-01T10:00:00Z' });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /cleaning-jobs/:id/status', () => {
  test('valid transition PENDING → ASSIGNED → 200', async () => {
    const assignedJob = { ...mockJob, status: 'ASSIGNED' };
    (prisma.cleaningJob.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockJob)
      .mockResolvedValueOnce(assignedJob);
    (prisma.cleaningJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const res = await request(app)
      .patch(`/cleaning-jobs/${jobId}/status`)
      .set('Authorization', admToken())
      .send({ status: 'ASSIGNED' });

    expect(res.status).toBe(200);
    expect(prisma.cleaningJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: jobId, tenantId }),
        data: { status: 'ASSIGNED' },
      }),
    );
  });

  test('invalid transition PENDING → DONE → 422', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(mockJob);

    const res = await request(app)
      .patch(`/cleaning-jobs/${jobId}/status`)
      .set('Authorization', admToken())
      .send({ status: 'DONE' });

    expect(res.status).toBe(422);
    expect(prisma.cleaningJob.updateMany).not.toHaveBeenCalled();
  });

  test('DONE → IN_PROGRESS invalid → 422', async () => {
    const doneJob = { ...mockJob, status: 'DONE' };
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(doneJob);

    const res = await request(app)
      .patch(`/cleaning-jobs/${jobId}/status`)
      .set('Authorization', admToken())
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(422);
  });

  test('job not found → 404', async () => {
    (prisma.cleaningJob.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .patch(`/cleaning-jobs/nonexistent/status`)
      .set('Authorization', admToken())
      .send({ status: 'ASSIGNED' });

    expect(res.status).toBe(404);
  });

  test('invalid status value → 422', async () => {
    const res = await request(app)
      .patch(`/cleaning-jobs/${jobId}/status`)
      .set('Authorization', admToken())
      .send({ status: 'INVALID_STATUS' });

    expect(res.status).toBe(422);
  });

  test('COORDINATOR can transition → 200', async () => {
    const assignedJob = { ...mockJob, status: 'ASSIGNED' };
    (prisma.cleaningJob.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockJob)
      .mockResolvedValueOnce(assignedJob);
    (prisma.cleaningJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const res = await request(app)
      .patch(`/cleaning-jobs/${jobId}/status`)
      .set('Authorization', coordToken())
      .send({ status: 'ASSIGNED' });

    expect(res.status).toBe(200);
  });
});
