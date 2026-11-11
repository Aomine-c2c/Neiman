'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NEIMAN_CONFIG } from '@neiman/config';

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(NEIMAN_CONFIG.ROUTES.DASHBOARD.HOME);
  }, [router]);

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-4 font-mono text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      Entering Command Center…
    </main>
  );
}

