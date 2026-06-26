import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { Role } from '@prisma/client';

interface LoginDto { identifier: string; password: string; tenantId: string; }

function signAccess(payload: { id: string; tenantId: string; role: Role }) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });
}

function signRefresh(payload: { id: string }) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });
}

export async function login({ identifier, password, tenantId }: LoginDto) {
  const isEmail = identifier.includes('@');
  const user = await prisma.user.findFirst({
    where: {
      tenantId,
      isActive: true,
      ...(isEmail ? { email: identifier } : { phone: identifier }),
    },
  });
  if (!user) throw new AppError('Invalid credentials', 401);
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError('Invalid credentials', 401);

  return {
    accessToken: signAccess({ id: user.id, tenantId: user.tenantId, role: user.role }),
    refreshToken: signRefresh({ id: user.id }),
    user: { id: user.id, name: user.name, role: user.role, phone: user.phone },
  };
}

export async function refresh(refreshToken: string) {
  let payload: { id: string };
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { id: string };
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }
  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user || !user.isActive) throw new AppError('User not found', 401);
  return { accessToken: signAccess({ id: user.id, tenantId: user.tenantId, role: user.role }) };
}
