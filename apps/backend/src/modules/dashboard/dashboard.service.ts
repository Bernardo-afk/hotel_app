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
