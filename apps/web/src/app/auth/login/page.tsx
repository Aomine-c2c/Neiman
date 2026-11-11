"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NEIMAN_CONFIG } from "@neiman/config";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center bg-background font-mono text-xs text-muted-foreground"
          role="status"
        >
          Entering Command Center…
        </div>
      }
    >
      <LoginRedirect />
    </Suspense>
  );
}

function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get("next");
    const destination =
      next?.startsWith("/") && !next.startsWith("//")
        ? next
        : NEIMAN_CONFIG.ROUTES.DASHBOARD.HOME;
    router.replace(destination);
  }, [router, searchParams]);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background font-mono text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      Entering Command Center…
    </div>
  );
}

