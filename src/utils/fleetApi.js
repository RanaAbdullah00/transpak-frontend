/** Normalize GET /trucks/mine — supports legacy array or paginated payload. */
export function normalizeTrucksResponse(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

export function normalizeFleetListResponse(data) {
  if (Array.isArray(data)) return { items: data, total: data.length };
  if (data && Array.isArray(data.items)) {
    return { items: data.items, total: Number(data.total) || data.items.length };
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
