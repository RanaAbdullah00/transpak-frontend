import axios from 'axios';

// Base URL: explicit VITE_API_URL wins. In dev, empty/unset uses same-origin `/api` (Vite proxy → backend).
function apiBaseUrl() {
  const raw = import.meta.env.VITE_API_URL;
  const explicit = typeof raw === 'string' ? raw.trim() : '';
  if (explicit) {
    let base = explicit.replace(/\/$/, '');
    if (!base.endsWith('/api')) base = `${base}/api`;
    return base;
  }
  if (import.meta.env.DEV) return '/api';
  return 'http://localhost:5000/api';
}

const BASE_URL = apiBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('transpak_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use((response) => {
  const body = response.data;
  if (body && typeof body.success === 'boolean' && 'data' in body) {
    return { ...response, data: body.data };
  }
  return response;
});

export default api;

