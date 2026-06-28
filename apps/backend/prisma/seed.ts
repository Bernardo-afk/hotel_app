import { PrismaClient, Role, UrgencyLevel, CleaningJobStatus, ReservationStatus, PropertyStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Limpa tudo na ordem certa ────────────────────────────────────────────────
  await prisma.jobEventLog.deleteMany();
  await prisma.cleaningReport.deleteMany();
  await prisma.cleaningIncident.deleteMany();
  await prisma.cleaningAssignment.deleteMany();
  await prisma.cleaningJob.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.maintenanceTicket.deleteMany();
  await prisma.property.deleteMany();
  await prisma.condominium.deleteMany();
  await prisma.candidacyRequest.deleteMany();
  await prisma.transportRecord.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.cleanerAvailability.deleteMany();
  await prisma.inviteToken.deleteMany();
  await prisma.reimbursementPeriod.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // ── Tenant ───────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Gestora',
      slug: 'demo',
    },
  });
  console.log(`✅ Tenant: ${tenant.name} (id: ${tenant.id})`);

  // ── Usuários ─────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('senha123', 10);

  const adm = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      role: Role.ADM,
      name: 'Admin Demo',
      email: 'adm@demo.com',
      phone: '11900000001',
      passwordHash,
    },
  });

  const coordinator = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      role: Role.COORDINATOR,
      name: 'João Coordinator',
      email: 'coordinator@demo.com',
      phone: '11900000002',
      passwordHash,
    },
  });

  const cleaner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      role: Role.CLEANER,
      name: 'Maria Cleaner',
      email: 'cleaner@demo.com',
      phone: '11900000003',
      passwordHash,
      streakCount: 3,
    },
  });

  const cleaner2 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      role: Role.CLEANER,
      name: 'Pedro Limpeza',
      email: 'pedro@demo.com',
      phone: '11900000004',
      passwordHash,
    },
  });

  console.log(`✅ Usuários: ${adm.name}, ${coordinator.name}, ${cleaner.name}, ${cleaner2.name}`);

  // ── Condomínios ───────────────────────────────────────────────────────────────
  const condo1 = await prisma.condominium.create({
    data: {
      tenantId: tenant.id,
      name: 'Residencial Flores',
      address: 'Rua das Flores, 100 — São Paulo, SP',
      latitude: -23.5505,
      longitude: -46.6333,
    },
  });

  const condo2 = await prisma.condominium.create({
    data: {
      tenantId: tenant.id,
      name: 'Edifício Mar Azul',
      address: 'Av. Atlântica, 500 — São Paulo, SP',
      latitude: -23.5605,
      longitude: -46.6433,
    },
  });

  console.log(`✅ Condomínios: ${condo1.name}, ${condo2.name}`);

  // ── Propriedades ──────────────────────────────────────────────────────────────
  const [prop101, prop201, prop301, prop401] = await Promise.all([
    prisma.property.create({
      data: { tenantId: tenant.id, condominiumId: condo1.id, unitNumber: '101', status: PropertyStatus.ACTIVE },
    }),
    prisma.property.create({
      data: { tenantId: tenant.id, condominiumId: condo1.id, unitNumber: '201', status: PropertyStatus.ACTIVE },
    }),
    prisma.property.create({
      data: { tenantId: tenant.id, condominiumId: condo2.id, unitNumber: '301', status: PropertyStatus.ACTIVE },
    }),
    prisma.property.create({
      data: { tenantId: tenant.id, condominiumId: condo2.id, unitNumber: '401', status: PropertyStatus.ACTIVE },
    }),
  ]);

  console.log(`✅ Propriedades: Apto ${prop101.unitNumber}, ${prop201.unitNumber}, ${prop301.unitNumber}, ${prop401.unitNumber}`);

  // ── Datas relativas ───────────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCheckout = new Date(today);
  todayCheckout.setHours(11, 0, 0, 0); // checkout 11h

  const todayCheckin = (hoursFromNow: number) => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + hoursFromNow);
    return d;
  };

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(11, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // ── Reservas ──────────────────────────────────────────────────────────────────
  const [res1, res2, res3, res4] = await Promise.all([
    // RED — checkout ontem, novo checkin em 2h
    prisma.reservation.create({
      data: {
        tenantId: tenant.id,
        propertyId: prop101.id,
        guestName: 'Carlos Silva',
        checkIn: todayCheckin(2),
        checkOut: yesterday,
        status: ReservationStatus.CHECKED_OUT,
      },
    }),
    // YELLOW — checkout hoje, novo checkin em 6h
    prisma.reservation.create({
      data: {
        tenantId: tenant.id,
        propertyId: prop201.id,
        guestName: 'Ana Costa',
        checkIn: todayCheckin(6),
        checkOut: todayCheckout,
        status: ReservationStatus.CHECKED_OUT,
      },
    }),
    // GREEN — checkout hoje, checkin amanhã
    prisma.reservation.create({
      data: {
        tenantId: tenant.id,
        propertyId: prop301.id,
        guestName: 'Bruno Lima',
        checkIn: tomorrow,
        checkOut: todayCheckout,
        status: ReservationStatus.CHECKED_OUT,
      },
    }),
    // ASSIGNED — atribuído para Maria
    prisma.reservation.create({
      data: {
        tenantId: tenant.id,
        propertyId: prop401.id,
        guestName: 'Fernanda Rocha',
        checkIn: todayCheckin(4),
        checkOut: todayCheckout,
        status: ReservationStatus.CHECKED_OUT,
      },
    }),
  ]);

  // ── Cleaning Jobs ─────────────────────────────────────────────────────────────
  const [job1, job2, job3, job4] = await Promise.all([
    prisma.cleaningJob.create({
      data: {
        tenantId: tenant.id,
        propertyId: prop101.id,
        reservationId: res1.id,
        status: CleaningJobStatus.PENDING,
        urgencyLevel: UrgencyLevel.RED,
        scheduledDate: today,
      },
    }),
    prisma.cleaningJob.create({
      data: {
        tenantId: tenant.id,
        propertyId: prop201.id,
        reservationId: res2.id,
        status: CleaningJobStatus.PENDING,
        urgencyLevel: UrgencyLevel.YELLOW,
        scheduledDate: today,
      },
    }),
    prisma.cleaningJob.create({
      data: {
        tenantId: tenant.id,
        propertyId: prop301.id,
        reservationId: res3.id,
        status: CleaningJobStatus.PENDING,
        urgencyLevel: UrgencyLevel.GREEN,
        scheduledDate: today,
      },
    }),
    prisma.cleaningJob.create({
      data: {
        tenantId: tenant.id,
        propertyId: prop401.id,
        reservationId: res4.id,
        status: CleaningJobStatus.ASSIGNED,
        urgencyLevel: UrgencyLevel.YELLOW,
        scheduledDate: today,
      },
    }),
  ]);

  // ── Assignment para Maria no job 4 ────────────────────────────────────────────
  await prisma.cleaningAssignment.create({
    data: {
      tenantId: tenant.id,
      jobId: job4.id,
      cleanerId: cleaner.id,
      status: 'NOTIFIED',
      sortOrder: 1,
    },
  });

  console.log(`✅ Jobs: ${job1.id.slice(0,8)} (RED), ${job2.id.slice(0,8)} (YELLOW), ${job3.id.slice(0,8)} (GREEN), ${job4.id.slice(0,8)} (ASSIGNED→Maria)`);

  // ── Resumo ────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 CREDENCIAIS DE ACESSO (senha: senha123)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant slug / x-tenant-id : demo`);
  console.log(`Tenant ID                 : ${tenant.id}`);
  console.log('');
  console.log(`ADM          → phone: 11900000001  email: adm@demo.com`);
  console.log(`Coordinator  → phone: 11900000002  email: coordinator@demo.com`);
  console.log(`Cleaner      → phone: 11900000003  email: cleaner@demo.com`);
  console.log(`Cleaner 2    → phone: 11900000004  email: pedro@demo.com`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
