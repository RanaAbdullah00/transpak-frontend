export const DEFAULT_VISIBILITY_HOURS = 6;
export const DEFAULT_VISIBILITY_MINUTES = 0;

export function buildVisibilitySlot(hours, minutes) {
  const h = Math.max(0, Number(hours) || 0);
  const m = Math.max(0, Number(minutes) || 0);
  const durationMinutes = h * 60 + m;
  const safeMinutes = durationMinutes < 15 ? 15 : Math.min(durationMinutes, 72 * 60);
  const visibleUntil = new Date(Date.now() + safeMinutes * 60 * 1000).toISOString();
  return {
    type: 'visibility',
    durationMinutes: safeMinutes,
    visibleUntil
  };
}

export function parseVisibilityFromSlots(slots) {
  if (!Array.isArray(slots)) return null;
  const vis = slots.find((s) => s && s.type === 'visibility');
  if (!vis) return null;
  const durationMinutes = Number(vis.durationMinutes);
  const visibleUntil = vis.visibleUntil ? String(vis.visibleUntil) : null;
  return {
    durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : null,
    visibleUntil
  };
}

export function isListingVisibilityExpired(slots) {
  const vis = parseVisibilityFromSlots(slots);
  if (!vis?.visibleUntil) return false;
  const ts = new Date(vis.visibleUntil).getTime();
  return Number.isFinite(ts) && ts <= Date.now();
}

export function formatVisibilitySummary(slots, t) {
  const vis = parseVisibilityFromSlots(slots);
  if (!vis?.durationMinutes) return '';
  const h = Math.floor(vis.durationMinutes / 60);
  const m = vis.durationMinutes % 60;
  if (h && m) return t('loadsHub.visibilityDurationSummary', { h, m });
  if (h) return t('loadsHub.visibilityDurationHours', { h });
  return t('loadsHub.visibilityDurationMinutes', { m });
}

export function visibilitySlotsPayload(hours, minutes) {
  return [buildVisibilitySlot(hours, minutes)];
}
