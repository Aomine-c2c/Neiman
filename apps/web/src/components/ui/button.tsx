import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'cyber' | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-mono text-xs uppercase tracking-wider font-semibold transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-30 disabled:pointer-events-none active:scale-[0.97]';

    const variants: Record<string, string> = {
      default:
        'bg-[#D71921] text-white hover:bg-[#c0141c] active:bg-[#a81017] shadow-sm',
      cyber:
        'bg-secondary/40 text-foreground border border-border hover:border-foreground/40 hover:bg-secondary/80',
      glass:
        'border border-border/80 bg-card/60 backdrop-blur-md text-foreground hover:bg-secondary/60 hover:border-foreground/30',
      outline:
        'border border-border bg-transparent hover:bg-secondary/60 hover:border-foreground/40 text-foreground',
      ghost:
        'hover:bg-secondary/60 text-muted-foreground hover:text-foreground',
      destructive:
        'bg-[#D71921] text-white hover:bg-[#c0141c] shadow-sm',
      secondary:
        'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
    };

    const sizes: Record<string, string> = {
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
