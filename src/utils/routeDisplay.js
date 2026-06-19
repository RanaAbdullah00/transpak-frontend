/**
 * Resolve origin/destination from API row shapes and format a safe route label.
 */

export function resolveRouteEndpoints(row = {}) {
  const origin = String(
    row.origin ??
      row.origin_city ??
      row.originCity ??
      row.pickup ??
      row.loadOrigin ??
      ''
  ).trim();
  const destination = String(
    row.destination ??
      row.destination_city ??
      row.destinationCity ??
      row.delivery ??
      row.loadDestination ??
      ''
  ).trim();
  return { origin, destination };
}

/**
 * @param {string} origin
 * @param {string} destination
 * @param {(k: string) => string} t
 * @returns {string}
 */
export function formatRouteLabel(origin, destination, t) {
  const o = String(origin || '').trim();
  const d = String(destination || '').trim();
  if (!o && !d) {
    return t ? t('common.routeUnavailable') : 'Route unavailable';
  }
  if (!o || !d) {
    return o || d || (t ? t('common.routeUnavailable') : 'Route unavailable');
  }
  return `${o} → ${d}`;
}

/**
 * @param {object} row
 * @param {(k: string) => string} t
 * @returns {string}
 */
export function formatRouteLabelFromRow(row, t) {
  const { origin, destination } = resolveRouteEndpoints(row);
  return formatRouteLabel(origin, destination, t);
}
