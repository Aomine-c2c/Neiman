'use client';

import { Construction } from 'lucide-react';

interface ComingSoonProps {
  title: string;
  description?: string;
  phase?: string;
}

export function ComingSoon({ title, description, phase }: ComingSoonProps) {
  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/50">
          <Construction className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">Coming soon</p>
          {phase && (
            <p className="text-sm text-muted-foreground mt-1">
              Scheduled for <span className="text-primary font-medium">{phase}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
