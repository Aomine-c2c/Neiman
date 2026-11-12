/**
 * NEIMAN Universal RBAC & Capability Governance Contracts
 * Shared across Web, Desktop, and TUI.
 * 
 * Note: The backend remains the authoritative source of truth.
 * Frontend/TUI permission functions provide ergonomic presentation only.
 */

export type RBACRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'VIEWER';

export const ROLE_HIERARCHY: Record<RBACRole, number> = {
  VIEWER: 1,
  MANAGER: 2,
  ADMIN: 3,
  SUPERADMIN: 4,
};

export function hasRoleAccess(userRole: RBACRole, requiredRole: RBACRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

export interface CapabilityRule {
  capability: string;
  requiredRole: RBACRole;
  description: string;
  isDangerous?: boolean;
}

export const SYSTEM_CAPABILITIES: CapabilityRule[] = [
  { capability: 'read_telemetry', requiredRole: 'VIEWER', description: 'Inspect workspace metrics and observations' },
  { capability: 'trigger_simulations', requiredRole: 'MANAGER', description: 'Run sandboxed organization simulations' },
  { capability: 'manage_tasks_and_projects', requiredRole: 'MANAGER', description: 'Create and update tasks and milestones' },
  { capability: 'edit_ai_providers', requiredRole: 'ADMIN', description: 'Configure vendor API keys and gateways' },
  { capability: 'promote_simulation', requiredRole: 'ADMIN', description: 'Promote simulated sandbox state to live workforce' },
  { capability: 'execute_hard_rollback', requiredRole: 'ADMIN', description: 'Execute instant rollback of organizational state' },
  { capability: 'manage_permissions_and_constitution', requiredRole: 'SUPERADMIN', description: 'Modify organizational constitution and scopes', isDangerous: true },
];

export function canPerformCapability(userRole: RBACRole, capabilityName: string): boolean {
  const rule = SYSTEM_CAPABILITIES.find((c) => c.capability === capabilityName);
  if (!rule) return false;
  return hasRoleAccess(userRole, rule.requiredRole);
}
