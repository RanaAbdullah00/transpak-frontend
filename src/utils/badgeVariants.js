/** Bootstrap badge variants allowed in UI (prevents invalid / dark-mode black fallbacks). */
export const SAFE_BADGE_VARIANTS = new Set([
  'primary',
  'secondary',
  'success',
  'danger',
  'warning',
  'info'
]);

export function sanitizeBadgeVariant(variant) {
  const v = String(variant || 'unknown').toLowerCase().trim();
  if (!v || v === 'unknown' || v === 'default' || v === 'dark' || v === 'black') {
    return 'secondary';
  }
  return SAFE_BADGE_VARIANTS.has(v) ? v : 'secondary';
}