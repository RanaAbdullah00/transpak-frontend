/** Dashboard stat display — never show em-dash when value is 0. */
export function formatStatValue(value, { loading = false, failed = false } = {}) {
  if (loading) return null;
  if (failed && (value === null || value === undefined)) return '—';
  if (value === null || value === undefined) return '0';
  const n = Number(value);
  if (Number.isFinite(n)) return n.toLocaleString();
  return String(value);
}
