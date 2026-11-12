'use client';

import { useAuthStore, type NexoraUser } from '@/store/auth';

/** Resolve the active organization context. */
export function useOrganizationContext() {
  return useAuthStore((state) => state.activeCompany);
}

export function useAccountContext(): { user: NexoraUser | null } {
  const user = useAuthStore((state) => state.user);
  return { user };
}
