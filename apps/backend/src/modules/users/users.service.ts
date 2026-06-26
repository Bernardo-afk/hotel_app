import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';

export function list(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      role: true,
      phone: true,
      email: true,
      avatarUrl: true,
      streakCount: true,
    },
  });
}

export async function create(
  tenantId: string,
  data: {
    name: string;
    phone: string;
    email?: string;
    role: Role;
    cpf?: string;
    rg?: string;
    password: string;
  },
) {
  const { password, ...rest } = data;
  return prisma.user.create({
    data: {
      tenantId,
      ...rest,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
}

export async function update(
  tenantId: string,
  id: string,
  data: Partial<{ name: string; phone: string; email: string; fcmToken: string }>,
) {
  return prisma.user.update({ where: { id, tenantId }, data });
}

export async function deactivate(tenantId: string, id: string) {
  return prisma.user.update({ where: { id, tenantId }, data: { isActive: false } });
}

export async function createInviteToken(
  tenantId: string,
  createdById: string,
): Promise<{ inviteLink: string }> {
  const record = await prisma.inviteToken.create({
    data: {
      tenantId,
      createdById,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      inviteLink: '',
    },
  });
  const link = `${APP_BASE_URL}/register?token=${record.token}`;
  await prisma.inviteToken.update({
    where: { id: record.id },
    data: { inviteLink: link },
  });
  return { inviteLink: link };
}

export async function registerWithToken(dto: {
  token: string;
  name: string;
  phone: string;
  cpf: string;
  rg: string;
  password: string;
  avatarUrl?: string;
}) {
  const invite = await prisma.inviteToken.findUnique({ where: { token: dto.token } });
  if (!invite) throw new AppError('Invalid token', 400);
  if (invite.usedAt) throw new AppError('Token already used', 400);
  if (invite.expiresAt < new Date()) throw new AppError('Token expired', 400);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        tenantId: invite.tenantId,
        role: invite.role,
        name: dto.name,
        phone: dto.phone,
        cpf: dto.cpf,
        rg: dto.rg,
        avatarUrl: dto.avatarUrl,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });
    await tx.inviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date(), usedById: u.id },
    });
    return u;
  });

  const accessToken = jwt.sign(
    { id: user.id, tenantId: user.tenantId, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' },
  );
  return { accessToken };
}
