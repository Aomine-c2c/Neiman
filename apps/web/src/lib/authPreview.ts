/**
 * Local UI and workstation installations opt out of the login screen.
 * Enabled whenever NEXT_PUBLIC_NEIMAN_DEV_AUTH_BYPASS is set to 'true'.
 */
import { getDevAuthBypass } from '@neiman/config';

export function isDevelopmentAuthBypassEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return getDevAuthBypass();
}
