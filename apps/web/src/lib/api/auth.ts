/**
 * NEIMAN Auth API
 */

import { api } from './client';
import type { NexoraUser } from '@/store/auth';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export const authApi = {
  login: (body: LoginRequest) =>
    api.post<TokenResponse>('/api/v1/auth/login', body),

  register: (body: RegisterRequest) =>
    api.post<NexoraUser>('/api/v1/auth/register', body),

  me: () =>
    api.get<NexoraUser>('/api/v1/auth/me'),
};
