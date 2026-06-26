import { execSync } from 'child_process';
export default async function () {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
}
