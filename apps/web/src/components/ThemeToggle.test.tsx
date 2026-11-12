import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';
import { ThemeProvider } from './ThemeProvider';
import { NEIMAN_CONFIG } from '@neiman/config';

describe('ThemeToggle — Accessible Visual Theme Switcher', () => {
  const storageKey = NEIMAN_CONFIG.STORAGE_KEYS.THEME;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('renders toggle button with accessible labels and attributes', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /Toggle visual theme/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Switch to dark mode');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('data-theme', 'light');
  });

  it('toggles from light to dark on click', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /Toggle visual theme/i });
    fireEvent.click(button);

    expect(button).toHaveAttribute('title', 'Switch to light mode');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem(storageKey)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(button);

    expect(button).toHaveAttribute('title', 'Switch to dark mode');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem(storageKey)).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});

