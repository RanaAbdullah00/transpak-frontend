/** HTTPS-only image URLs (aligns with transpak-backend/utils/imageUrl.js). */
export function resolveImageUrl(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s || s.length > 2048) return '';
  if (/^data:/i.test(s)) return '';
  if (/^http:\/\//i.test(s)) return '';
  if (/^https:\/\//i.test(s)) return s;
  return '';
}

export function resolveImageUrlOrEmpty(value) {
  return resolveImageUrl(value) || '';
}
