import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Role = 'COORDINATOR' | 'ADM' | 'MANAGER' | 'SUPER_ADMIN' | 'CLEANER';

interface AuthState {
  token: string | null;
  tenantId: string | null;
  userId: string | null;
  role: Role | null;
  name: string | null;
  login: (payload: { token: string; tenantId: string; userId: string; role: Role; name: string }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      tenantId: null,
      userId: null,
      role: null,
      name: null,
      login: (payload) => set(payload),
      logout: () => set({ token: null, tenantId: null, userId: null, role: null, name: null }),
    }),
    { name: 'stay-auth' },
  ),
);
