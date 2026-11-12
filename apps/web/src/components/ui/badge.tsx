import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline' | 'cyber';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants: Record<string, string> = {
      default: 'bg-secondary text-secondary-foreground border border-border text-[10px] uppercase font-mono tracking-wider',
      primary: 'bg-[#D71921]/15 text-[#D71921] border border-[#D71921]/30 font-mono text-[10px] uppercase tracking-wider',
      cyber: 'bg-secondary/60 text-foreground border border-border font-mono tracking-widest text-[9px] uppercase',
      success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px] uppercase',
      warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[10px] uppercase',
      destructive: 'bg-[#D71921]/20 text-[#D71921] border border-[#D71921]/40 font-mono text-[10px] uppercase font-bold',
      outline: 'border border-border/80 bg-transparent text-muted-foreground font-mono text-[10px] uppercase',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-sm px-2 py-0.5 font-medium transition-colors select-none',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';
