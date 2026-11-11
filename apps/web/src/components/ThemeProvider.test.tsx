import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeProvider';
import { NEIMAN_CONFIG } from '@neiman/config';

function TestConsumer() {
  const { theme, resolvedTheme, isDark, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <span data-testid="isDark">{String(isDark)}</span>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('system')}>Set System</button>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
}

describe('ThemeProvider — Light/Dark Obsidian Theming Engine', () => {
  const storageKey = NEIMAN_CONFIG.STORAGE_KEYS.THEME;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('boots into modern Light Mode by default per Rule 3', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(screen.getByTestId('resolved').textContent).toBe('light');
    expect(screen.getByTestId('isDark').textContent).toBe('false');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('restores Dark Mode preference from localStorage and sets root dark class', () => {
    localStorage.setItem(storageKey, 'dark');

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
    expect(screen.getByTestId('isDark').textContent).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('toggles theme between light and dark and persists to localStorage', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <TestConsumer />
      </ThemeProvider>
    );

    // Initial state: light
    expect(screen.getByTestId('resolved').textContent).toBe('light');

    // Click toggle -> dark
    act(() => {
      screen.getByText('Toggle Theme').click();
    });

    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
    expect(screen.getByTestId('isDark').textContent).toBe('true');
    expect(localStorage.getItem(storageKey)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Click toggle again -> light
    act(() => {
      screen.getByText('Toggle Theme').click();
    });

    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(screen.getByTestId('resolved').textContent).toBe('light');
    expect(screen.getByTestId('isDark').textContent).toBe('false');
    expect(localStorage.getItem(storageKey)).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('supports explicit setTheme calls for light, dark, and system', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    act(() => {
      screen.getByText('Set Dark').click();
    });
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      screen.getByText('Set Light').click();
    });
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('syncs theme across browser tabs via storage event', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('resolved').textContent).toBe('light');

    // Simulate storage event from another tab
    act(() => {
      const storageEvent = new StorageEvent('storage', {
        key: storageKey,
        newValue: 'dark',
      });
      window.dispatchEvent(storageEvent);
    });

    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

