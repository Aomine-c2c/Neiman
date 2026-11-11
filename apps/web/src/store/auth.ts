/**
 * NEIMAN Auth Store — Zustand
 * Manages JWT token, current user, and active company context.
 */
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { NEIMAN_CONFIG } from '@neiman/config';

export interface NexoraUser {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
}

export interface NexoraCompany {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  mission?: string | null;
  vision?: string | null;
  industry?: string | null;
  status: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  token: string | null;
  user: NexoraUser | null;
  activeCompany: NexoraCompany | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setToken: (token: string | null) => void;
  setUser: (user: NexoraUser | null) => void;
  setActiveCompany: (company: NexoraCompany | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

const DEFAULT_LOCAL_OPERATOR: NexoraUser = {
  id: 'local-operator',
  email: 'admin@neiman.ai',
  username: 'admin',
  first_name: 'Local',
  last_name: 'Operator',
  is_active: true,
  is_superuser: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: DEFAULT_LOCAL_OPERATOR,
      activeCompany: null,
      isAuthenticated: true,
      isLoading: false,
      error: null,

      setToken: (token) =>
        set((state) => ({
          token,
          isAuthenticated: true,
          user: state.user ?? DEFAULT_LOCAL_OPERATOR,
        })),

      setUser: (user) =>
        set({ user: user ?? DEFAULT_LOCAL_OPERATOR, isAuthenticated: true }),

      setActiveCompany: (company) =>
        set({ activeCompany: company }),

      setLoading: (isLoading) =>
        set({ isLoading }),

      setError: (error) =>
        set({ error }),

      logout: () =>
        set({
          token: null,
          user: DEFAULT_LOCAL_OPERATOR,
          activeCompany: null,
          isAuthenticated: true,
          error: null,
        }),
    }),
    {
      name: NEIMAN_CONFIG.STORAGE_KEYS.AUTH,
      storage: createJSONStorage(() => localStorage),
      // Only persist these fields
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        activeCompany: state.activeCompany,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
