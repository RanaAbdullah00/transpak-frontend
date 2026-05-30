/**
 * Per-tab auth token storage — prevents cross-tab account bleed (localStorage is shared).
 * Migrates legacy localStorage token once, then uses sessionStorage only.
 */

const TOKEN_KEY = 'transpak_token';
const LEGACY_KEY = 'transpak_token';

export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  const session = sessionStorage.getItem(TOKEN_KEY);
  if (session) return session;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    sessionStorage.setItem(TOKEN_KEY, legacy);
    localStorage.removeItem(LEGACY_KEY);
    return legacy;
  }
  return null;
}

export function setAuthToken(token) {
  if (typeof window === 'undefined') return;
  const value = String(token || '').trim();
  if (!value) {
    clearAuthToken();
    return;
  }
  const prev = sessionStorage.getItem(TOKEN_KEY);
  if (prev === value) return;
  sessionStorage.setItem(TOKEN_KEY, value);
  localStorage.removeItem(LEGACY_KEY);
  window.dispatchEvent(new CustomEvent('tp:auth-token-changed', { detail: { token: value } }));
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return;
  const had = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_KEY);
  if (had) {
    window.dispatchEvent(new CustomEvent('tp:auth-token-changed', { detail: { token: null } }));
  }
}
