/** HTTPS-only image URLs (aligns with transpak-backend/utils/imageUrl.js). */
export function resolveImageUrl(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s || s.length > 2048) return '';
  if (/^blob:/i.test(s)) return s;
  if (/^data:image\//i.test(s)) return s;
  if (/^https:\/\//i.test(s)) return s;
  if (/^http:\/\//i.test(s)) return `https://${s.slice(7)}`;
  if (s.startsWith('//')) return `https:${s}`;
  return '';
}

export function resolveImageUrlOrEmpty(value) {
  return resolveImageUrl(value) || '';
}
