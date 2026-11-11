'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio } from 'lucide-react';
import { NEIMAN_CONFIG } from '@neiman/config';

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to /dashboard if navigated to an unregistered route
    const timer = setTimeout(() => {
      router.replace(NEIMAN_CONFIG.ROUTES.DASHBOARD.HOME);
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-NEIMAN-dark text-foreground px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25 mb-4">
        <Radio className="h-8 w-8 animate-pulse text-primary" />
      </div>
      <h1 className="text-xl font-bold tracking-tight">Navigating to NEIMAN Control Room</h1>
      <p className="mt-2 text-sm text-muted-foreground font-mono">Redirecting you to the active workspace operating picture...</p>
      <Link
        href={NEIMAN_CONFIG.ROUTES.DASHBOARD.HOME}
        className="mt-6 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
      >
        Go to Dashboard now
      </Link>
    </div>
  );
}
