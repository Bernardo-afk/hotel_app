import { PrismaClient } from '@prisma/client';
export default async function () {
  const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_TEST } } });
  await p.$disconnect();
}
