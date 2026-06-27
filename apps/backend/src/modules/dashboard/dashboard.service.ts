import { AssignmentStatus, CleaningJobStatus, PropertyStatus, UrgencyLevel } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import PDFDocument from 'pdfkit';

export interface DashboardStats {
  totalJobs: number;
  jobsByStatus: Record<string, number>;
  totalCleaners: number;
  avgDurationMinutes: number;
  openIncidents: number;
  openMaintenanceTickets: number;
  urgencyBreakdown: { RED: number; YELLOW: number; GREEN: number };
}

export async function getDashboardStats(
  tenantId: string,
  filters?: { from?: Date; to?: Date },
): Promise<DashboardStats> {
  const dateWhere =
    filters?.from || filters?.to
      ? {
          scheduledDate: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {};

  const [
    totalJobs,
    jobsByStatusRaw,
    totalCleaners,
    urgencyRaw,
    openIncidents,
    openMaintenanceTickets,
    completedAssignments,
  ] = await Promise.all([
    prisma.cleaningJob.count({ where: { tenantId, ...dateWhere } }),
    prisma.cleaningJob.groupBy({
      by: ['status'],
      where: { tenantId, ...dateWhere },
      _count: { id: true },
    }),
    prisma.user.count({ where: { tenantId, role: 'CLEANER', isActive: true } }),
    prisma.cleaningJob.groupBy({
      by: ['urgencyLevel'],
      where: { tenantId, ...dateWhere },
      _count: { id: true },
    }),
    prisma.cleaningIncident.count({ where: { tenantId } }),
    prisma.maintenanceTicket.count({ where: { tenantId, status: 'OPEN' } }),
    prisma.cleaningAssignment.findMany({
      where: {
        tenantId,
        startedAt: { not: null },
        completedAt: { not: null },
      },
      select: { startedAt: true, completedAt: true },
    }),
  ]);

  const jobsByStatus: Record<string, number> = {};
  for (const g of jobsByStatusRaw) {
    jobsByStatus[g.status] = g._count.id;
  }

  const urgencyBreakdown = {
    RED: urgencyRaw.find((g) => g.urgencyLevel === 'RED')?._count.id ?? 0,
    YELLOW: urgencyRaw.find((g) => g.urgencyLevel === 'YELLOW')?._count.id ?? 0,
    GREEN: urgencyRaw.find((g) => g.urgencyLevel === 'GREEN')?._count.id ?? 0,
  };

  const durations = completedAssignments
    .filter(
      (a): a is { startedAt: Date; completedAt: Date } =>
        a.startedAt !== null && a.completedAt !== null,
    )
    .map((a) => (a.completedAt.getTime() - a.startedAt.getTime()) / 60000);

  const avgDurationMinutes =
    durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

  return {
    totalJobs,
    jobsByStatus,
    totalCleaners,
    avgDurationMinutes,
    openIncidents,
    openMaintenanceTickets,
    urgencyBreakdown,
  };
}

export async function exportPdf(
  tenantId: string,
  filters?: { from?: Date; to?: Date },
): Promise<{ buffer: Buffer; filename: string }> {
  const stats = await getDashboardStats(tenantId, filters);

  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const filename = `dashboard-${tenantId}-${new Date().toISOString().slice(0, 10)}.pdf`;
      resolve({ buffer, filename });
    });

    doc.fontSize(16).text('STAY Dashboard Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Date: ${new Date().toISOString().slice(0, 10)}`);
    doc.moveDown();
    doc.text(`Total Jobs: ${stats.totalJobs}`);
    doc.text(`Total Cleaners: ${stats.totalCleaners}`);
    doc.text(`Avg Duration (min): ${stats.avgDurationMinutes.toFixed(1)}`);
    doc.text(`Open Incidents: ${stats.openIncidents}`);
    doc.text(`Open Maintenance Tickets: ${stats.openMaintenanceTickets}`);
    doc.moveDown();
    doc.text('Urgency Breakdown:');
    doc.text(`  RED: ${stats.urgencyBreakdown.RED}`);
    doc.text(`  YELLOW: ${stats.urgencyBreakdown.YELLOW}`);
    doc.text(`  GREEN: ${stats.urgencyBreakdown.GREEN}`);
    doc.moveDown();
    doc.text('Jobs by Status:');
    for (const [status, count] of Object.entries(stats.jobsByStatus)) {
      doc.text(`  ${status}: ${count}`);
    }

    doc.end();
  });
}

// ── Coordinator Dashboard ────────────────────────────────────────────────────

export interface JobCard {
  id: string;
  status: CleaningJobStatus;
  urgencyLevel: UrgencyLevel;
  scheduledDate: string;
  property: {
    id: string;
    unitNumber: string;
    status: PropertyStatus;
    condominium: { id: string; name: string };
  };
  reservation: {
    checkIn: string;
    checkOut: string;
    guestName: string | null;
  } | null;
  assignments: {
    id: string;
    cleanerId: string;
    status: AssignmentStatus;
    cleaner: { id: string; name: string };
  }[];
}

export interface CleanerRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
  currentAssignment: {
    assignmentId: string;
    assignmentStatus: AssignmentStatus;
    job: {
      id: string;
      urgencyLevel: UrgencyLevel;
      property: {
        unitNumber: string;
        condominium: { name: string };
      };
    };
  } | null;
}

export interface CoordinatorDashboard {
  metrics: {
    urgent: number;
    attention: number;
    completed: number;
    pending: number;
  };
  jobs_by_urgency: {
    RED: JobCard[];
    YELLOW: JobCard[];
    GREEN: JobCard[];
  };
  team_live: CleanerRow[];
  pending_count: number;
}

export async function getCoordinatorDashboard(tenantId: string): Promise<CoordinatorDashboard> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [urgent, attention, completed, pending, activeJobs, cleaners] = await Promise.all([
    prisma.cleaningJob.count({
      where: {
        tenantId,
        urgencyLevel: 'RED',
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
    }),
    prisma.cleaningJob.count({
      where: {
        tenantId,
        urgencyLevel: 'YELLOW',
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
    }),
    prisma.cleaningJob.count({
      where: {
        tenantId,
        status: 'DONE',
        scheduledDate: { gte: today },
      },
    }),
    prisma.cleaningJob.count({
      where: {
        tenantId,
        status: { in: ['STAND_BY', 'PARTIAL'] },
      },
    }),
    prisma.cleaningJob.findMany({
      where: {
        tenantId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        property: { status: { not: 'BLOCKED' } },
      },
      include: {
        property: { include: { condominium: true } },
        reservation: true,
        assignments: { include: { cleaner: true } },
      },
      orderBy: [{ urgencyLevel: 'asc' }, { scheduledDate: 'asc' }],
    }),
    prisma.user.findMany({
      where: { tenantId, role: 'CLEANER', isActive: true },
      include: {
        assignments: {
          where: { tenantId, status: { in: ['NOTIFIED', 'IN_PROGRESS'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            job: {
              include: { property: { include: { condominium: true } } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const jobs_by_urgency: { RED: JobCard[]; YELLOW: JobCard[]; GREEN: JobCard[] } = {
    RED: [],
    YELLOW: [],
    GREEN: [],
  };

  for (const job of activeJobs) {
    const level = job.urgencyLevel;
    jobs_by_urgency[level].push({
      id: job.id,
      status: job.status,
      urgencyLevel: job.urgencyLevel,
      scheduledDate: job.scheduledDate.toISOString(),
      property: {
        id: job.property.id,
        unitNumber: job.property.unitNumber,
        status: job.property.status,
        condominium: {
          id: job.property.condominium.id,
          name: job.property.condominium.name,
        },
      },
      reservation: job.reservation
        ? {
            checkIn: job.reservation.checkIn.toISOString(),
            checkOut: job.reservation.checkOut.toISOString(),
            guestName: job.reservation.guestName,
          }
        : null,
      assignments: job.assignments.map((a) => ({
        id: a.id,
        cleanerId: a.cleanerId,
        status: a.status,
        cleaner: { id: a.cleaner.id, name: a.cleaner.name },
      })),
    });
  }

  const team_live: CleanerRow[] = cleaners.map((cleaner) => {
    const latestAssignment = cleaner.assignments[0] ?? null;
    return {
      id: cleaner.id,
      name: cleaner.name,
      avatarUrl: cleaner.avatarUrl,
      isActive: cleaner.isActive,
      currentAssignment: latestAssignment
        ? {
            assignmentId: latestAssignment.id,
            assignmentStatus: latestAssignment.status,
            job: {
              id: latestAssignment.job.id,
              urgencyLevel: latestAssignment.job.urgencyLevel,
              property: {
                unitNumber: latestAssignment.job.property.unitNumber,
                condominium: { name: latestAssignment.job.property.condominium.name },
              },
            },
          }
        : null,
    };
  });

  return {
    metrics: { urgent, attention, completed, pending },
    jobs_by_urgency,
    team_live,
    pending_count: pending,
  };
}
