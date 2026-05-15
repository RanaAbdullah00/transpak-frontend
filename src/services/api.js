import axios from 'axios';
import { getApiRoot, API_BASE } from '../config/apiConfig.js';

const BASE_URL = getApiRoot();

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
        : `Cannot reach API (${target || 'VITE_API_URL not set'}). Check Cloudflare build env VITE_API_URL=https://transpak-backend.onrender.com`;
    }
    return Promise.reject(error);
  }
);

export { API_BASE, BASE_URL };
export default api;
