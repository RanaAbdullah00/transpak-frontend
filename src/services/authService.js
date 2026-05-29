import axios from 'axios';
import { getAuthApiUrl } from '../config/apiConfig.js';
import { unwrapBody } from '../utils/unwrapApi.js';
import { getAuthToken } from '../utils/authTokenStorage.js';

/** Only these HTTP methods may be used from this module. */
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH']);

function redactAuthPayload(data) {
  if (!data || typeof data !== 'object') return data;
  const copy = { ...data };
  for (const key of ['password', 'confirmPassword', 'code']) {
    if (copy[key] != null) copy[key] = '[redacted]';
  }
  return copy;
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function normalizeAuthError(err, method) {
  const body = err?.response?.data;
  if (body && typeof body === 'object') {
    if (!body.code && typeof body.error === 'string') body.code = body.error;
    const msg =
      typeof body.message === 'string' && body.message.trim()
        ? body.message.trim()
        : typeof body.error === 'string'
          ? body.error.trim()
          : '';
    if (msg) {
      err.message = body.code && !msg.includes(body.code) ? `${msg} (${body.code})` : msg;
    }
  }
  if (import.meta.env.DEV || import.meta.env.VITE_AUTH_API_DEBUG === 'true') {
    // eslint-disable-next-line no-console
    console.error('[auth-api] error', {
    method: err?.config?.method?.toUpperCase() || method,
    url: err?.config?.url,
    status: err?.response?.status,
    message: err?.message,
    code: body?.code,
    error: body?.error,
    data: body
    });
  }
  return err;
}

function unwrapAuthResponse(res) {
  const data = res?.data != null ? unwrapBody(res.data) : null;
  return {
    ...res,
    data: data != null && typeof data === 'object' && !Array.isArray(data) ? data : {}
  };
}

/**
 * Single gateway for all /api/auth/* calls. Always uses absolute URL from getAuthApiUrl.
 */
async function authRequest(method, authPath, body = undefined) {
  const httpMethod = String(method || 'POST').toUpperCase();
  if (!ALLOWED_METHODS.has(httpMethod)) {
    throw new Error(`authService: unsupported method ${httpMethod}`);
  }

  const url = getAuthApiUrl(authPath);

  const authDebug = import.meta.env.DEV || import.meta.env.VITE_AUTH_API_DEBUG === 'true';
  if (authDebug) {
    // eslint-disable-next-line no-console
    console.log('[auth-api] request', {
      method: httpMethod,
      url,
      payload: body !== undefined ? redactAuthPayload(body) : undefined
    });
  }

  try {
    const config = {
      method: httpMethod,
      url,
      headers: authHeaders(),
      withCredentials: true
    };
    if (body !== undefined && httpMethod !== 'GET') {
      config.data = body;
    }

    const res = await axios.request(config);
    if (authDebug) {
      // eslint-disable-next-line no-console
      console.log('[auth-api] response', {
        method: httpMethod,
        url,
        status: res?.status,
        ok: res?.status >= 200 && res?.status < 300
      });
    }
    return unwrapAuthResponse(res);
  } catch (err) {
    throw normalizeAuthError(err, httpMethod);
  }
}

/** Write operations — POST only */
function authPost(authPath, body) {
  return authRequest('POST', authPath, body);
}

export const loginApi = (credentials) => authPost('/auth/login', credentials);

export const registerApi = (payload) => authPost('/auth/register', payload);

export const addRoleApi = (role) => authPost('/auth/add-role', { role });

export const verifyRegisterOtpApi = (payload) => authPost('/auth/otp/register/verify', payload);

export const resendRegisterOtpApi = (payload) => authPost('/auth/otp/register/resend', payload);

export const sendForgotPasswordOtpApi = (payload) => authPost('/auth/otp/forgot/send', payload);

export const resetPasswordWithOtpApi = (payload) => authPost('/auth/otp/forgot/reset', payload);

/** Session read — GET /auth/profile (not a write operation) */
export const fetchProfileApi = () => authRequest('GET', '/auth/profile');

/** Session update — PATCH /auth/active-role */
export const patchActiveRoleApi = (activeRole) =>
  authRequest('PATCH', '/auth/active-role', { activeRole });
