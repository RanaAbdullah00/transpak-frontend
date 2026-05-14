import api from './api.js';

// Loadboard related API calls.
export const fetchLoads = (params) =>
  api.get('/loads', { params });

export const postLoad = (payload) =>
  api.post('/loads', payload);

