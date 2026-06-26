import { suggestRoute } from './route-suggestion.service';
import { prisma } from '../../lib/prisma';
import { haversineKm } from '../../lib/haversine';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    cleaningAssignment: {
      findMany: jest.fn(),
    },
  },
}));

const tenantId = 'tenant-1';
const cleanerId = 'cleaner-1';
const testDate = new Date('2026-06-26T00:00:00.000Z');

function makeAssignment(
  jobId: string,
  scheduledDate: Date,
  unitNumber: string,
  condoName: string,
  lat: number,
  lng: number,
) {
  return {
    id: `assign-${jobId}`,
    tenantId,
    cleanerId,
    jobId,
    job: {
      id: jobId,
      scheduledDate,
      property: {
        id: `prop-${jobId}`,
        unitNumber,
        condominium: {
          id: `condo-${jobId}`,
          name: condoName,
          latitude: lat,
          longitude: lng,
        },
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── suggestRoute ───────────────────────────────────────────────────────────

describe('suggestRoute', () => {
  test('returns empty stops for cleaner with no assignments', async () => {
    (prisma.cleaningAssignment.findMany as jest.Mock).mockResolvedValue([]);

    const result = await suggestRoute(tenantId, cleanerId, testDate);

    expect(result.stops).toHaveLength(0);
    expect(result.totalDistanceKm).toBe(0);
    expect(result.totalEstimatedCostBrl).toBe(0);
  });

  test('sets distanceFromPreviousKm=0 and estimatedCostBrl=0 for first stop', async () => {
    const assignment = makeAssignment(
      'job-1',
      new Date('2026-06-26T09:00:00Z'),
      '101',
      'Condo Alpha',
      -23.5505,
      -46.6333,
    );
    (prisma.cleaningAssignment.findMany as jest.Mock).mockResolvedValue([assignment]);

    const result = await suggestRoute(tenantId, cleanerId, testDate);

    expect(result.stops).toHaveLength(1);
    expect(result.stops[0].distanceFromPreviousKm).toBe(0);
    expect(result.stops[0].estimatedCostBrl).toBe(0);
    expect(result.stops[0].jobId).toBe('job-1');
    expect(result.stops[0].propertyUnitNumber).toBe('101');
    expect(result.stops[0].condominiumName).toBe('Condo Alpha');
  });

  test('computes correct distance and cost between two stops', async () => {
    // SP → RJ: approximately 357km
    const spLat = -23.5505;
    const spLng = -46.6333;
    const rjLat = -22.9068;
    const rjLng = -43.1729;

    const a1 = makeAssignment(
      'job-1',
      new Date('2026-06-26T09:00:00Z'),
      '101',
      'Condo SP',
      spLat,
      spLng,
    );
    const a2 = makeAssignment(
      'job-2',
      new Date('2026-06-26T11:00:00Z'),
      '202',
      'Condo RJ',
      rjLat,
      rjLng,
    );
    (prisma.cleaningAssignment.findMany as jest.Mock).mockResolvedValue([a1, a2]);

    const result = await suggestRoute(tenantId, cleanerId, testDate);

    expect(result.stops).toHaveLength(2);

    // First stop: zero distance
    expect(result.stops[0].distanceFromPreviousKm).toBe(0);
    expect(result.stops[0].estimatedCostBrl).toBe(0);

    // Second stop: haversine SP → RJ
    const expectedDistKm = haversineKm(spLat, spLng, rjLat, rjLng);
    const expectedCost = expectedDistKm * 1.8;
    expect(result.stops[1].distanceFromPreviousKm).toBeCloseTo(expectedDistKm, 5);
    expect(result.stops[1].estimatedCostBrl).toBeCloseTo(expectedCost, 5);

    // Distance should be ~357km (SP to RJ)
    expect(result.stops[1].distanceFromPreviousKm).toBeGreaterThan(350);
    expect(result.stops[1].distanceFromPreviousKm).toBeLessThan(365);

    expect(result.totalDistanceKm).toBeCloseTo(expectedDistKm, 5);
    expect(result.totalEstimatedCostBrl).toBeCloseTo(expectedCost, 5);
  });

  test('tenantId is included in the prisma query', async () => {
    (prisma.cleaningAssignment.findMany as jest.Mock).mockResolvedValue([]);

    await suggestRoute(tenantId, cleanerId, testDate);

    expect(prisma.cleaningAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
  });

  test('cleanerId is included in the prisma query', async () => {
    (prisma.cleaningAssignment.findMany as jest.Mock).mockResolvedValue([]);

    await suggestRoute(tenantId, cleanerId, testDate);

    expect(prisma.cleaningAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, cleanerId }),
      }),
    );
  });

  test('sorts stops by scheduledDate ascending', async () => {
    const a1 = makeAssignment(
      'job-early',
      new Date('2026-06-26T08:00:00Z'),
      '101',
      'Condo A',
      -23.5505,
      -46.6333,
    );
    const a2 = makeAssignment(
      'job-late',
      new Date('2026-06-26T14:00:00Z'),
      '202',
      'Condo B',
      -22.9068,
      -43.1729,
    );
    // Return in reverse order — service must sort
    (prisma.cleaningAssignment.findMany as jest.Mock).mockResolvedValue([a2, a1]);

    const result = await suggestRoute(tenantId, cleanerId, testDate);

    expect(result.stops[0].jobId).toBe('job-early');
    expect(result.stops[1].jobId).toBe('job-late');
  });
});
