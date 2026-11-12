'use client';

import React from 'react';

// Semantic ANSI to Tailwind/CSS mappings (light & dark mode compliant)
const ANSI_COLOR_MAP: Record<number, string> = {
  30: 'text-zinc-600 dark:text-zinc-400',       // Black
  31: 'text-red-600 dark:text-red-400',         // Red
  32: 'text-emerald-600 dark:text-emerald-400', // Green
  33: 'text-amber-600 dark:text-amber-400',     // Yellow
  34: 'text-blue-600 dark:text-blue-400',       // Blue
  35: 'text-purple-600 dark:text-purple-400',   // Magenta
  36: 'text-cyan-600 dark:text-cyan-400',       // Cyan
  37: 'text-zinc-800 dark:text-zinc-200',       // White

  // Bright variants
  90: 'text-zinc-500 dark:text-zinc-500',       // Bright Black (Gray)
  91: 'text-red-500 dark:text-red-300',         // Bright Red
  92: 'text-emerald-500 dark:text-emerald-300', // Bright Green
  93: 'text-amber-500 dark:text-amber-300',     // Bright Yellow
  94: 'text-blue-500 dark:text-blue-300',       // Bright Blue
  95: 'text-purple-500 dark:text-purple-300',   // Bright Magenta
  96: 'text-cyan-500 dark:text-cyan-300',       // Bright Cyan
  97: 'text-zinc-900 dark:text-zinc-100',       // Bright White
};

const ANSI_BG_MAP: Record<number, string> = {
  40: 'bg-zinc-800/80',
  41: 'bg-red-500/20',
  42: 'bg-emerald-500/20',
  43: 'bg-amber-500/20',
  44: 'bg-blue-500/20',
  45: 'bg-purple-500/20',
  46: 'bg-cyan-500/20',
  47: 'bg-zinc-200/50',
};

export interface AnsiToken {
  text: string;
  className: string;
}

/**
 * Parses raw ANSI terminal string into an array of styled tokens.
 */
export function parseAnsiString(raw: string): AnsiToken[] {
  if (!raw) return [];

  // Strip non-color control sequences like cursor movements \x1b[?25h, \x1b[2J, \x1b[K
  const sanitized = raw
    .replace(/\x1b\[\?([0-9;]+)[a-zA-Z]/g, '')
    .replace(/\x1b\[[0-9;]*[A-HJKST]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const regex = /\x1b\[([0-9;]*)m/g;
  const tokens: AnsiToken[] = [];

  let lastIndex = 0;
  let currentClasses: Set<string> = new Set();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sanitized)) !== null) {
    const textPart = sanitized.substring(lastIndex, match.index);
    if (textPart) {
      tokens.push({
        text: textPart,
        className: Array.from(currentClasses).join(' '),
      });
    }

    const codeStr = match[1];
    if (!codeStr || codeStr === '0') {
      currentClasses.clear();
    } else {
      const codes = codeStr.split(';').map((c) => parseInt(c, 10));
      for (const code of codes) {
        if (code === 0) {
          currentClasses.clear();
        } else if (code === 1) {
          currentClasses.add('font-bold');
        } else if (code === 2) {
          currentClasses.add('opacity-70');
        } else if (code === 3) {
          currentClasses.add('italic');
        } else if (code === 4) {
          currentClasses.add('underline');
        } else if (ANSI_COLOR_MAP[code]) {
          // Remove any existing fg color before adding new one
          for (const c of currentClasses) {
            if (c.startsWith('text-')) currentClasses.delete(c);
          }
          currentClasses.add(ANSI_COLOR_MAP[code]);
        } else if (ANSI_BG_MAP[code]) {
          for (const c of currentClasses) {
            if (c.startsWith('bg-')) currentClasses.delete(c);
          }
          currentClasses.add(ANSI_BG_MAP[code]);
        }
      }
    }

    lastIndex = regex.lastIndex;
  }

  const remaining = sanitized.substring(lastIndex);
  if (remaining) {
    tokens.push({
      text: remaining,
      className: Array.from(currentClasses).join(' '),
    });
  }

  return tokens;
}

export interface AnsiRendererProps {
  content: string;
  className?: string;
}

export function AnsiRenderer({ content, className = '' }: AnsiRendererProps) {
  const tokens = React.useMemo(() => parseAnsiString(content), [content]);

  return (
    <pre className={`font-mono text-xs leading-relaxed whitespace-pre-wrap break-all ${className}`}>
      {tokens.map((token, idx) => (
        <span key={idx} className={token.className || undefined}>
          {token.text}
        </span>
      ))}
    </pre>
  );
}

