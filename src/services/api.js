import axios from 'axios';
import { getApiRoot, API_BASE } from '../config/apiConfig.js';

const BASE_URL = getApiRoot();

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

const AUTH_DEBUG =
  import.meta.env.DEV || String(import.meta.env.VITE_AUTH_API_DEBUG || '').toLowerCase() === 'true';

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('transpak_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  const method = String(config.method || 'get').toUpperCase();
  const url = config.url || '';
  const fullUrl = /^https?:\/\//i.test(url)
    ? url
    : `${String(config.baseURL || '').replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
  const isAuth = /\/api\/auth(\/|$)/i.test(fullUrl) || /\/auth(\/|$)/i.test(url);
  if (isAuth && !/^https?:\/\//i.test(url) && url.startsWith('/')) {
    // eslint-disable-next-line no-console
    console.error(
      '[api] relative auth path bypasses authService — use authService.js only:',
      fullUrl
    );
  }
  if (isAuth) {
    const payload =
      config.data && typeof config.data === 'object' && !(config.data instanceof FormData)
        ? { ...config.data }
        : config.data;
    if (payload && typeof payload === 'object') {
      for (const key of ['password', 'confirmPassword', 'code']) {
        if (payload[key] != null) payload[key] = '[redacted]';
      }
    }
    if (AUTH_DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[api] auth request', { method, url: fullUrl, payload });
    }
    const postOnly =
      /\/auth\/(register|login|otp\/|send-otp|verify-otp|resend-otp)/i.test(fullUrl) ||
      /\/auth\/add-role$/i.test(fullUrl);
    if (postOnly && method !== 'POST') {
      // eslint-disable-next-line no-console
      console.error('[api] auth POST-only route called with wrong method:', method, fullUrl);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body.success === 'boolean' && 'data' in body) {
      return { ...response, data: body.data };
    }
    return response;
  },
  (error) => {
    if (!error.response && error.code === 'ERR_NETWORK') {
      const target = API_BASE || BASE_URL;
      error.message = import.meta.env.DEV
        ? `Cannot reach API (${target}). Start transpak-backend and set VITE_PROXY_TARGET in transpak-frontend/.env.`
        : `Cannot reach API (${target || 'VITE_API_URL not set'}). Rebuild frontend with VITE_API_URL set to your Render URL; ensure Render CORS allows your Cloudflare Pages domain.`;
    }
    const body = error.response?.data;
    if (body && typeof body === 'object') {
      if (!body.code && typeof body.error === 'string') {
        body.code = body.error;
      }
      const msg =
        typeof body.message === 'string' && body.message.trim()
          ? body.message.trim()
          : typeof body.error === 'string'
            ? body.error.trim()
            : '';
      if (msg) {
        error.message =
          body.code && !msg.includes(body.code) ? `${msg} (${body.code})` : msg;
      }
    }
    if (AUTH_DEBUG && error.config?.url && /\/auth(\/|$)/i.test(error.config.url)) {
      // eslint-disable-next-line no-console
      console.error('[api] auth error', {
        method: error.config?.method,
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data
      });
    }
    return Promise.reject(error);
  }
);

export { API_BASE, BASE_URL };
export default api;
