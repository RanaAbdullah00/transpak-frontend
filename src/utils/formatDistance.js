/**
 * Display distance for UI — never fabricates values.
 * @param {number|string|null|undefined} km
 * @param {(key: string) => string} [t] - optional i18n
 * @returns {{ display: string, km: number|null, available: boolean }}
 */
export function formatDistanceKm(km, t) {
  const n = Number(km);
  if (Number.isFinite(n) && n > 0) {
    const rounded = Math.round(n);
    return {
      display: `${rounded} km`,
      km: rounded,
      available: true
    };
  }
  const unavailable = t ? t('common.distanceUnavailable') : 'Distance unavailable';
  return { display: unavailable, km: null, available: false };
}

/** Short label for inline use (LoadCard distance slot). */
export function distanceLabel(km, t) {
  return formatDistanceKm(km, t).display;
}
