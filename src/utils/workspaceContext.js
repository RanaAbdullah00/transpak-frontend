/**
 * Client workspace identity for API + cache scoping (mirrors user.activeRole in DB).
 */
import { getWorkspace } from './workspace.js';

const STORAGE_KEY = 'tp_workspace_ctx';

function readSessionOwner() {
  if (typeof window === 'undefined') return '';
  return String(sessionStorage.getItem('transpak_session_owner') || '').trim();
}

export function persistWorkspaceContext(user) {
  if (typeof window === 'undefined' || !user?.id) return;
  const workspace = getWorkspace(user);
  const ctx = {
    userId: String(user.id),
    workspace,
    activeRole: workspace
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  sessionStorage.setItem('transpak_session_owner', String(user.id));
  sessionStorage.setItem('transpak_active_role', workspace);
}

export function readWorkspaceContext() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId) return null;
    const owner = readSessionOwner();
    if (owner && owner !== String(parsed.userId)) {
      clearWorkspaceContext();
      return null;
    }
    return {
      userId: String(parsed.userId),
      workspace: String(parsed.workspace || parsed.activeRole || ''),
      activeRole: String(parsed.activeRole || parsed.workspace || '')
    };
  } catch {
    return null;
  }
}

export function clearWorkspaceContext() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem('transpak_active_role');
}
