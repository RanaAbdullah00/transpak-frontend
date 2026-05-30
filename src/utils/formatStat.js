/** Dashboard stat display — null means unknown/unavailable, not zero. */
export function formatStatValue(value, { loading = false, failed = false } = {}) {
  if (loading) return null;
  if (value === null || value === undefined) return failed ? '—' : '—';
  const n = Number(value);
  if (Number.isFinite(n)) return n.toLocaleString();
  return String(value);
}
