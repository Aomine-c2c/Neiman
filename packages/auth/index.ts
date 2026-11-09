/**
 * NEIMAN Universal Auth Contracts & User State
 * Shared across Web, Desktop, and TUI.
 */

import { NEIMAN_CONFIG } from '@neiman/config';

export interface NexoraUser {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface SessionState {
  token: string | null;
  user: NexoraUser | null;
  isAuthenticated: boolean;
}

export const DEFAULT_ADMIN_USER: Readonly<LoginCredentials> = {
  email: NEIMAN_CONFIG.AUTH.DEFAULT_ADMIN_EMAIL,
  password: NEIMAN_CONFIG.AUTH.DEFAULT_ADMIN_PASSWORD,
};
