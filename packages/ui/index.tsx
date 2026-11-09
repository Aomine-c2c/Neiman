/**
 * NEIMAN Shared Graphical UI Primitives
 * Reusable across Web and Desktop (Tauri) interfaces.
 */

import * as React from 'react';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'cyber' | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]';

    const variants = {
      default:
        'bg-primary text-primary-foreground font-semibold shadow-sm hover:brightness-110 active:brightness-95 hover:shadow-primary/25 hover:shadow-md',
      cyber:
        'bg-primary/10 text-primary border border-primary/40 hover:bg-primary hover:text-primary-foreground hover:shadow-lg hover:shadow-primary/20 hover:border-primary',
      glass:
        'glass-card text-foreground hover:bg-secondary/80 hover:border-primary/40',
      outline:
        'border border-border bg-card/50 hover:bg-secondary hover:border-primary/40 text-foreground',
      ghost:
        'hover:bg-secondary text-foreground hover:text-primary',
      destructive:
        'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
      secondary:
        'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/50',
    };

    const sizes = {
      default: 'h-10 px-4 py-2 text-sm rounded-lg',
      sm: 'h-8 px-3 text-xs rounded-md',
      xs: 'h-7 px-2.5 text-xs rounded-md',
      lg: 'h-11 px-6 text-base rounded-xl',
      icon: 'h-9 w-9 rounded-lg',
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline' | 'cyber';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-secondary text-secondary-foreground border border-border/50',
      primary: 'bg-primary/15 text-primary border border-primary/30 font-semibold',
      cyber: 'bg-primary/10 text-primary border border-primary/40 font-mono tracking-wider text-[10px]',
      success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
      warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
      destructive: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30',
      outline: 'border border-border bg-card/40 text-foreground',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow = false, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-border/70 bg-card/80 text-card-foreground backdrop-blur-md transition-all duration-200 shadow-sm',
        glow && 'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10',
        interactive && 'cursor-pointer hover:border-border hover:bg-card hover:-translate-y-0.5 active:translate-y-0',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';
