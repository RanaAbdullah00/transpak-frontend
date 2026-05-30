/** Normalize GET /trucks/mine — supports legacy array or paginated payload. */
import { ensureArray } from './unwrapApi.js';

export function normalizeTrucksResponse(data) {
  return ensureArray(data);
}

export function normalizeFleetListResponse(data) {
  const items = ensureArray(data);
  if (Array.isArray(data)) return { items, total: items.length };
  if (data && typeof data === 'object' && Array.isArray(data.items)) {
    return { items, total: Number(data.total) || items.length };
  }
  return { items: [], total: 0 };
}

export function fleetStatusBadgeClass(statusLabel) {
  const s = String(statusLabel || '').toUpperCase();
  if (s === 'APPROVED') return 'bg-success';
  if (s === 'SUSPENDED') return 'bg-danger';
  return 'bg-warning text-dark';
}

export function isTruckMatchingEligible(truck) {
  if (!truck) return false;
  if (truck.matchingEligible === true) return true;
  const label = String(truck.statusLabel || truck.status || '').toUpperCase();
  return label === 'APPROVED' || label === 'ACTIVE';
}
