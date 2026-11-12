/**
 * NEIMAN Organizations API
 */

import { api } from './client';
import type { NexoraCompany } from '@/store/auth';

export interface CreateCompanyRequest {
  name: string;
  description?: string;
  mission?: string;
  vision?: string;
  industry?: string;
  dna?: {
    operating_philosophy?: string;
    innovation_level?: string;
    autonomy_level?: string;
    risk_tolerance?: string;
    quality_threshold?: string;
    decision_style?: string;
    communication_style?: string;
    resource_strategy?: string;
  };
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  purpose?: string | null;
  status: string;
  parent_id?: string | null;
  manager_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgRole {
  id: string;
  department_id: string;
  company_id: string;
  title: string;
  responsibilities: string[];
  capabilities: string[];
  authority: string;
  required_skills: string[];
  autonomy_level: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const organizationsApi = {
  // Companies
  create: (body: CreateCompanyRequest) =>
    api.post<NexoraCompany>('/api/v1/companies', body),

  list: () =>
    api.get<NexoraCompany[]>('/api/v1/companies/me'),

  get: (id: string) =>
    api.get<NexoraCompany>(`/api/v1/companies/${id}`),

  update: (id: string, body: Partial<CreateCompanyRequest>) =>
    api.patch<NexoraCompany>(`/api/v1/companies/${id}`, body),


  // Departments
  listDepartments: (companyId: string) =>
    api.get<Department[]>(`/api/v1/companies/${companyId}/departments`),

  createDepartment: (companyId: string, body: { name: string; purpose?: string; parent_id?: string }) =>
    api.post<Department>(`/api/v1/companies/${companyId}/departments`, body),

  // Roles
  listRoles: (companyId: string) =>
    api.get<OrgRole[]>(`/api/v1/companies/${companyId}/roles`),

  // Members
  listMembers: (companyId: string) =>
    api.get<CompanyMember[]>(`/api/v1/companies/${companyId}/members`),
};
