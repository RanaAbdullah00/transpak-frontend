import { fetchProfileApi } from '../services/authService.js';
import { safeUnwrapAuthResponse } from './authApiSafe.js';
import { applyAuthSessionFromApi } from './authSession.js';

let refreshInFlight = null;

/**
 * Re-sync JWT + AuthContext user from GET /auth/profile (DB source of truth).
 */
export async function refreshAuthSessionFromServer() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetchProfileApi();
      const data = safeUnwrapAuthResponse(res);
      if (!data?.user) return null;
      const { token, user } = applyAuthSessionFromApi(data);
      window.dispatchEvent(
        new CustomEvent('tp:auth-refreshed', { detail: { token, user } })
      );
      return { token, user, raw: data };
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}
