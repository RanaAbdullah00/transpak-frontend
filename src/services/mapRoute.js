import api from './api.js';
import { unwrapBody } from '../utils/unwrapApi.js';

/**
 * Fetch driving route polyline via backend ORS proxy (key never sent to browser).
 * @param {{ origin: string, destination: string }} params
 */
export async function fetchRouteByCities({ origin, destination }) {
  const res = await api.get('/maps/route', {
    params: { origin, destination },
    skipGlobalErrorToast: true
  });
  return unwrapBody(res.data);
}

/**
 * @param {{ origin?: string, destination?: string, coordinates?: Array }} body
 */
export async function fetchRoute(body) {
  const res = await api.post('/maps/route', body, { skipGlobalErrorToast: true });
  return unwrapBody(res.data);
}
