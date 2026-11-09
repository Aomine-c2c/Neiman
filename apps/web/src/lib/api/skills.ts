/**
 * NEIMAN Procedural Skills & Playbooks API Client
 */

import { api } from './client';

export interface SkillResponse {
  name: string;
  display_name: string;
  description?: string | null;
  category: string;
  bound_roles: string[];
  is_active: boolean;
  path: string;
  has_scripts: boolean;
  content_preview?: string | null;
}

export interface SkillSyncResponse {
  total_skills_discovered: number;
  skills_bound_to_roles: number;
  roles_updated: string[];
  synced_at: string;
}

export interface SkillImportGitRequest {
  repository_url: string;
  branch?: string;
  skill_name: string;
  bind_role?: string | null;
}

export interface SkillCreateCustomRequest {
  skill_name: string;
  display_name: string;
  category?: string;
  content: string;
  bind_role?: string | null;
}

export const skillsApi = {
  listSkills: (companyId: string): Promise<SkillResponse[]> =>
    api.get<SkillResponse[]>(`/api/v1/companies/${companyId}/skills`),

  syncDiskSkills: (companyId: string): Promise<SkillSyncResponse> =>
    api.post<SkillSyncResponse>(`/api/v1/companies/${companyId}/skills/sync-disk`),

  importGitSkill: (companyId: string, data: SkillImportGitRequest): Promise<SkillResponse> =>
    api.post<SkillResponse>(`/api/v1/companies/${companyId}/skills/import-git`, data),

  createCustomSkill: (companyId: string, data: SkillCreateCustomRequest): Promise<SkillResponse> =>
    api.post<SkillResponse>(`/api/v1/companies/${companyId}/skills/create-custom`, data),
};
