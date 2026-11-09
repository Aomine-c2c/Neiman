'use client';

/**
 * NEIMAN Company & Workspace Guard
 * Zero-authentication operator mode: renders protected workspace routes immediately
 * while hydrating the local operator profile in the background when available.
 */

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/lib/api/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { setUser } = useAuthStore();

  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((user) => {
        if (active && user) {
          setUser(user);
        }
      })
      .catch(() => {
        // Authentication is disabled; ignore session errors and never redirect.
      });

    return () => {
      active = false;
    };
  }, [setUser]);

  return <>{children}</>;
}

export const CompanyGuard = AuthGuard;

