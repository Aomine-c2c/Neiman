'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/60 text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-secondary hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer',
        className
      )}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label="Toggle visual theme"
      aria-pressed={isDark}
      data-theme={resolvedTheme}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-foreground" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-foreground" />
    </button>
  );
}
