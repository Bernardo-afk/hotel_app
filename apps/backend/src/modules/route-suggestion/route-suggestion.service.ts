import { prisma } from '../../lib/prisma';
import { haversineKm } from '../../lib/haversine';

const COST_PER_KM = 1.8; // R$ 1.80/km

export interface RouteStop {
  jobId: string;
  propertyUnitNumber: string;
  condominiumName: string;
  scheduledDate: Date;
  distanceFromPreviousKm: number;
  estimatedCostBrl: number;
}

export interface RouteResult {
  stops: RouteStop[];
  totalDistanceKm: number;
  totalEstimatedCostBrl: number;
}

export async function suggestRoute(
  tenantId: string,
  cleanerId: string,
  date: Date,
): Promise<RouteResult> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const assignments = await prisma.cleaningAssignment.findMany({
    where: {
      tenantId,
      cleanerId,
      job: {
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    },
    include: {
      job: {
        include: {
          property: {
            include: {
              condominium: true,
            },
          },
        },
      },
    },
  });

  // Sort by scheduledDate ascending
  assignments.sort(
    (a, b) => a.job.scheduledDate.getTime() - b.job.scheduledDate.getTime(),
  );

  let totalDistanceKm = 0;
  let totalEstimatedCostBrl = 0;

  const stops: RouteStop[] = assignments.map((assignment, index) => {
    const { job } = assignment;
    const { property } = job;
    const { condominium } = property;

    let distanceFromPreviousKm = 0;
    let estimatedCostBrl = 0;

    if (index > 0) {
      const prev = assignments[index - 1];
      const prevCondo = prev.job.property.condominium;
      distanceFromPreviousKm = haversineKm(
        Number(prevCondo.latitude),
        Number(prevCondo.longitude),
        Number(condominium.latitude),
        Number(condominium.longitude),
      );
      estimatedCostBrl = distanceFromPreviousKm * COST_PER_KM;
      totalDistanceKm += distanceFromPreviousKm;
      totalEstimatedCostBrl += estimatedCostBrl;
    }

    return {
      jobId: job.id,
      propertyUnitNumber: property.unitNumber,
      condominiumName: condominium.name,
      scheduledDate: job.scheduledDate,
      distanceFromPreviousKm,
      estimatedCostBrl,
    };
  });

  return {
    stops,
    totalDistanceKm,
    totalEstimatedCostBrl,
  };
}
