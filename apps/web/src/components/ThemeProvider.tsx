'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { NEIMAN_CONFIG } from '@neiman/config';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderContextType {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeProviderContext = createContext<ThemeProviderContextType>({
  theme: 'light',
  resolvedTheme: 'light',
  isDark: false,
  setTheme: () => null,
  toggleTheme: () => null,
});

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = NEIMAN_CONFIG.STORAGE_KEYS.THEME,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light');
  const [mounted, setMounted] = useState(false);

  // Initial local storage hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedTheme = localStorage.getItem(storageKey) as Theme | null;
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
          setThemeState(savedTheme);
        }
      } catch {
        // ignore localStorage errors
      }
    }
    setMounted(true);
  }, [storageKey]);

  // Synchronize across browser tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        if (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system') {
          setThemeState(e.newValue as Theme);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [storageKey]);

  // Apply resolved theme and attach system preference listener
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const root = document.documentElement;

    const applyTheme = (effective: 'dark' | 'light') => {
      setResolvedTheme(effective);
      root.classList.remove('light', 'dark');
      root.classList.add(effective);
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');

      const handleMediaChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleMediaChange);
      return () => mediaQuery.removeEventListener('change', handleMediaChange);
    } else {
      applyTheme(theme);
    }
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch {
      // ignore
    }
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <ThemeProviderContext.Provider
      value={{
        theme,
        resolvedTheme,
        isDark: resolvedTheme === 'dark',
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeProviderContext);
