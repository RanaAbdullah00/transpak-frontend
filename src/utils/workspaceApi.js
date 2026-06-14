/**
 * Workspace-scoped API helpers — server enforces auth; client sends consistent scope hints.
 */
import { getWorkspace } from './workspace.js';
import { readWorkspaceContext } from './workspaceContext.js';

export function viewAsQuery(user) {
  const v = user?.activeRole;
  if (v === 'shipper' || v === 'carrier') return { viewAs: v };
  return {};
}

/**
 * Standard query params for list/read APIs (Phase 2 workspace isolation).
 */
export function workspaceQueryParams(user) {
  if (!user?.id) return {};
  const ctx = { userId: String(user.id), workspace: getWorkspace(user) };
  const workspace =
    ctx.workspace === 'shipper' || ctx.workspace === 'carrier' || ctx.workspace === 'admin'
      ? ctx.workspace
      : getWorkspace(user);
  const out = {
    user_id: ctx.userId,
    workspace
  };
  if (workspace === 'shipper' || workspace === 'carrier') {
    out.viewAs = workspace;
  }
  return out;
}

export function notificationQueryParams(user, extra = {}) {
  if (!user?.id) return { ...extra };
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const dualCommercial = roles.includes('shipper') && roles.includes('carrier');
  if (dualCommercial) {
    return { user_id: String(user.id), includeAllRoles: 1, ...extra };
  }
  return { ...workspaceQueryParams(user), ...extra };
}

export function mergeWorkspaceParams(user, params = {}) {
  return { ...workspaceQueryParams(user), ...params };
}
