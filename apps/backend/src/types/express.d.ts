import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user: { id: string; tenantId: string; role: Role };
      tenantId: string;
    }
  }
}

export {};
