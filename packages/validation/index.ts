/**
 * NEIMAN Universal Validation Rules
 * Shared across Web, Desktop, and TUI.
 */

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 8;
}

export function isValidSafeIdentifier(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

export function isValidDeepLink(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('neiman://')) return false;
  if (url.includes('\n') || url.includes('\r') || url.includes('\0')) return false;
  return url.length <= 2048;
}

export function isSafeExportFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') return false;
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..') || filename.includes('\0')) {
    return false;
  }
  const lower = filename.toLowerCase();
  return lower.endsWith('.json') || lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.md');
}
