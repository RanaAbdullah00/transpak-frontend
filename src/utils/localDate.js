/** Local calendar date as YYYY-MM-DD (not UTC — avoids timezone off-by-one on date inputs). */
export function localTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** True when `isoDate` is on or after local today. */
export function isOnOrAfterLocalToday(isoDate) {
  const s = String(isoDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return s >= localTodayISO();
}
