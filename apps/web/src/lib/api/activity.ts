/**
 * Realtime Activity Stream Client API
 * Fetches recent activity and establishes native WebSocket connections with automatic reconnection.
 */

import { getApiBaseUrl, getWsBaseUrl } from '@neiman/config';
import { api } from './client';
export type {
  ActivityEventType,
  ActivitySeverity,
  ActivityEvent,
  ActivityFilterQuery,
} from '@neiman/events';
import type { ActivityFilterQuery, ActivityEvent } from '@neiman/events';

export const activityApi = {
  getRecentActivity: (companyId: string, params?: ActivityFilterQuery): Promise<ActivityEvent[]> => {
    const q = new URLSearchParams();
    if (params?.agent) q.append('agent', params.agent);
    if (params?.department) q.append('department', params.department);
    if (params?.project) q.append('project', params.project);
    if (params?.event && params.event !== 'ALL') q.append('event', params.event);
    if (params?.severity && params.severity !== 'ALL') q.append('severity', params.severity);
    if (params?.limit) q.append('limit', params.limit.toString());
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return api.get<ActivityEvent[]>(`/api/v1/companies/${companyId}/activity${queryStr}`);
  },

  emitEvent: (companyId: string, event: Partial<ActivityEvent>): Promise<ActivityEvent> => {
    return api.post<ActivityEvent>(`/api/v1/companies/${companyId}/activity/emit`, event);
  },

  getWebSocketUrl: (companyId: string): string => {
    const wsBase = getWsBaseUrl().replace(/\/$/, '');
    return `${wsBase}/api/v1/companies/${companyId}/activity/ws`;
  },

  getStreamUrl: (companyId: string): string => {
    const apiBase = getApiBaseUrl().replace(/\/$/, '');
    return `${apiBase}/api/v1/companies/${companyId}/activity/stream`;
  },
};
