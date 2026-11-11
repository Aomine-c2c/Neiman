'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NEIMAN_CONFIG } from '@neiman/config';
import { NeimanLogo } from '@/components/ui/NeimanLogo';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(NEIMAN_CONFIG.ROUTES.DASHBOARD.HOME);
    const timer = setTimeout(() => {
      window.location.href = NEIMAN_CONFIG.ROUTES.DASHBOARD.HOME;
    }, 1200);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-sans select-none p-4">
      <div className="rounded-xl border border-border bg-card p-8 max-w-sm w-full space-y-6 shadow-sm">
        <div className="flex flex-col items-center justify-center border-b border-border pb-5 gap-3">
          <NeimanLogo size="lg" showWordmark={true} withGlow={false} priority={true} />
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Engineering OS Ready
          </span>
        </div>

        <div className="space-y-2.5 text-center">
          <p className="text-sm font-medium text-foreground">
            Autonomous Software Engineering Workspace
          </p>
          <p className="text-xs text-muted-foreground">
            Initializing repository topology, specialist squad, and model router…
          </p>
          <div className="flex justify-center pt-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        </div>

        <div className="pt-3 flex items-center justify-between text-xs border-t border-border">
          <a
            href={NEIMAN_CONFIG.ROUTES.DASHBOARD.HOME}
            className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
          >
            Enter Workspace <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <span className="text-[11px] font-mono text-muted-foreground">
            v0.2
          </span>
        </div>
      </div>
    </div>
  );
}
