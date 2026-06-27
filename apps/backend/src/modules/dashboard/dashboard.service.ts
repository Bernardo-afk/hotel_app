import { AssignmentStatus, CleaningJobStatus, PropertyStatus, UrgencyLevel } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import PDFDocument from 'pdfkit';
import { AppError } from '../../errors/AppError';

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

// ── ADM Dashboard ────────────────────────────────────────────────────────────

export interface AlertItem {
  type: 'BLOCKED_PROPERTY' | 'CRITICAL_TICKET' | 'STANDBY_TIMEOUT' | 'URGENT_UNASSIGNED';
  severity: 'CRITICAL' | 'WARNING';
  message: string;
  property?: { id: string; unitNumber: string; condominium: string };
  ticket?: { id: string; title: string };
  job?: { id: string };
  elapsed_minutes?: number;
}

export interface CoordinatorRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
  stats: {
    cleaners: number;
    apts: number;
    cleaned: number;
    pending: number;
    open_tickets: number;
    has_alerts: boolean;
  };
}

export interface AdmDashboard {
  metrics: {
    total_apts_today: number;
    completed: number;
    urgent: number;
    open_tickets: number;
    active_cleaners: number;
  };
  coordinators: CoordinatorRow[];
  alert_strip: AlertItem[];
}

export async function getAlertStrip(tenantId: string): Promise<{ alerts: AlertItem[] }> {
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const [blockedProperties, criticalTickets, standByJobs, urgentUnassignedJobs] =
    await Promise.all([
      prisma.property.findMany({
        where: {
          tenantId,
          status: 'BLOCKED',
          reservations: { some: { checkIn: { gt: now } } },
        },
        include: {
          condominium: true,
          reservations: {
            where: { checkIn: { gt: now } },
            select: { id: true },
          },
        },
      }),
      prisma.maintenanceTicket.findMany({
        where: {
          tenantId,
          status: 'OPEN',
          createdAt: { lt: threeHoursAgo },
        },
      }),
      prisma.cleaningJob.findMany({
        where: { tenantId, status: 'STAND_BY' },
        include: {
          property: { include: { condominium: true } },
          eventLogs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.cleaningJob.findMany({
        where: {
          tenantId,
          urgencyLevel: 'RED',
          status: 'PENDING',
          assignments: { none: {} },
        },
        include: {
          property: { include: { condominium: true } },
        },
      }),
    ]);

  const alerts: AlertItem[] = [];

  for (const prop of blockedProperties) {
    const n = prop.reservations.length;
    alerts.push({
      type: 'BLOCKED_PROPERTY',
      severity: 'WARNING',
      message: `Apt ${prop.unitNumber} bloqueado — ${n} reserva(s) futura(s) afetada(s)`,
      property: {
        id: prop.id,
        unitNumber: prop.unitNumber,
        condominium: prop.condominium.name,
      },
    });
  }

  for (const ticket of criticalTickets) {
    const elapsedMinutes = Math.floor((now.getTime() - ticket.createdAt.getTime()) / 60000);
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    alerts.push({
      type: 'CRITICAL_TICKET',
      severity: 'CRITICAL',
      message: `Chamado crítico #${ticket.id} sem decisão por ${elapsedHours}h`,
      ticket: { id: ticket.id, title: ticket.description },
      elapsed_minutes: elapsedMinutes,
    });
  }

  for (const job of standByJobs) {
    const lastEvent = job.eventLogs[0];
    const lastActivity = lastEvent ? lastEvent.createdAt : job.updatedAt;
    if (lastActivity <= twoHoursAgo) {
      const elapsedMinutes = Math.floor((now.getTime() - lastActivity.getTime()) / 60000);
      alerts.push({
        type: 'STANDBY_TIMEOUT',
        severity: 'CRITICAL',
        message: `Apt ${job.property.unitNumber} em STAND_BY há mais de 2h`,
        property: {
          id: job.property.id,
          unitNumber: job.property.unitNumber,
          condominium: job.property.condominium.name,
        },
        job: { id: job.id },
        elapsed_minutes: elapsedMinutes,
      });
    }
  }

  for (const job of urgentUnassignedJobs) {
    alerts.push({
      type: 'URGENT_UNASSIGNED',
      severity: 'CRITICAL',
      message: `Apt ${job.property.unitNumber} URGENTE sem empregada atribuída`,
      property: {
        id: job.property.id,
        unitNumber: job.property.unitNumber,
        condominium: job.property.condominium.name,
      },
      job: { id: job.id },
    });
  }

  alerts.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'CRITICAL' ? -1 : 1;
  });

  return { alerts };
}

export async function getAdmDashboard(tenantId: string): Promise<AdmDashboard> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    total_apts_today,
    completedCount,
    urgentCount,
    openTicketsCount,
    activeCleaners,
    coordCleaners,
    coordPending,
    coordHasAlertsCount,
    coordinatorUsers,
    alertStripResult,
  ] = await Promise.all([
    prisma.cleaningJob.count({
      where: { tenantId, scheduledDate: { gte: today, lt: tomorrow } },
    }),
    prisma.cleaningJob.count({
      where: { tenantId, status: 'DONE', scheduledDate: { gte: today, lt: tomorrow } },
    }),
    prisma.cleaningJob.count({
      where: { tenantId, urgencyLevel: 'RED', status: { notIn: ['DONE', 'CANCELLED'] } },
    }),
    prisma.maintenanceTicket.count({ where: { tenantId, status: 'OPEN' } }),
    prisma.user.count({ where: { tenantId, role: 'CLEANER', isActive: true } }),
    prisma.user.count({
      where: {
        tenantId,
        role: 'CLEANER',
        isActive: true,
        assignments: { some: { tenantId, status: { in: ['NOTIFIED', 'IN_PROGRESS'] } } },
      },
    }),
    prisma.cleaningJob.count({ where: { tenantId, status: { in: ['STAND_BY', 'PARTIAL'] } } }),
    prisma.cleaningJob.count({
      where: {
        tenantId,
        urgencyLevel: 'RED',
        status: { notIn: ['DONE', 'CANCELLED'] },
        assignments: { none: {} },
      },
    }),
    prisma.user.findMany({
      where: { tenantId, role: 'COORDINATOR' },
      select: { id: true, name: true, avatarUrl: true, isActive: true },
      orderBy: { name: 'asc' },
    }),
    getAlertStrip(tenantId),
  ]);

  const sharedStats = {
    cleaners: coordCleaners,
    apts: total_apts_today,
    cleaned: completedCount,
    pending: coordPending,
    open_tickets: openTicketsCount,
    has_alerts: coordHasAlertsCount > 0,
  };

  const coordinators: CoordinatorRow[] = coordinatorUsers.map((u) => ({
    id: u.id,
    name: u.name,
    avatarUrl: u.avatarUrl,
    isActive: u.isActive,
    stats: sharedStats,
  }));

  return {
    metrics: {
      total_apts_today,
      completed: completedCount,
      urgent: urgentCount,
      open_tickets: openTicketsCount,
      active_cleaners: activeCleaners,
    },
    coordinators,
    alert_strip: alertStripResult.alerts,
  };
}

export async function getAdmCoordinatorPanel(
  tenantId: string,
  coordinatorId: string,
): Promise<CoordinatorDashboard> {
  const coordinator = await prisma.user.findFirst({
    where: { id: coordinatorId, tenantId, role: 'COORDINATOR' },
    select: { id: true },
  });

  if (!coordinator) {
    throw new AppError('Coordinator not found', 404);
  }

  return getCoordinatorDashboard(tenantId);
}
