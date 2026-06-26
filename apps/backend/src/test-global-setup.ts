import { execSync } from 'child_process';
export default async function () {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } catch {
    // DB not available — unit tests that don't need DB will still run
  }
}
