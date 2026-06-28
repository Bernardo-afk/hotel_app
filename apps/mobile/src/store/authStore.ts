import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { Role } from '../types';

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  tenantId: string | null;
  userId: string | null;
  role: Role | null;
  name: string | null;
  phone: string | null;
  streakCount: number;
  login: (payload: {
    accessToken: string;
    refreshToken: string;
    tenantId: string;
    userId: string;
    role: Role;
    name: string;
    phone: string;
  }) => void;
  logout: () => void;
  setStreak: (count: number) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      tenantId: null,
      userId: null,
      role: null,
      name: null,
      phone: null,
      streakCount: 0,
      login: (payload) => set(payload),
      logout: () => set({ accessToken: null, refreshToken: null, tenantId: null, userId: null, role: null, name: null, phone: null, streakCount: 0 }),
      setStreak: (count) => set({ streakCount: count }),
    }),
    {
      name: 'stay-mobile-auth',
      storage: createJSONStorage(() => secureStorage),
    },
  ),
);
