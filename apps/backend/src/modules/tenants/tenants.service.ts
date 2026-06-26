import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

export const list = () => prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });

export async function create(data: { name: string; slug: string }) {
  const exists = await prisma.tenant.findUnique({ where: { slug: data.slug } });
  if (exists) throw new AppError('Slug already in use', 409);
  return prisma.tenant.create({ data });
}

export async function update(id: string, data: { name?: string; slug?: string }) {
  return prisma.tenant.update({ where: { id }, data }).catch(() => {
    throw new AppError('Tenant not found', 404);
  });
}

export async function remove(id: string) {
  await prisma.tenant.delete({ where: { id } }).catch(() => {
    throw new AppError('Tenant not found', 404);
  });
}
