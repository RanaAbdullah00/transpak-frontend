/**
 * Drop client-only demo/socket placeholders. Real notifications come from API or authenticated socket.
 */
const SIMULATED = /simulated\s*:/i;

export function isRenderableClientNotification(raw) {
  if (!raw || typeof raw !== 'object') return false;
  const msg = String(raw.message ?? raw.title ?? '').trim();
  if (!msg) return false;
  if (SIMULATED.test(msg)) return false;
  const sender = String(raw.senderId ?? '');
  const receiver = String(raw.receiverId ?? '');
  if (sender === 'system' && receiver === 'local') return false;
  return true;
}

const ALLOWED_ROLES = new Set(['shipper', 'carrier', 'admin']);

export function sanitizeNotificationRoleType(roleType) {
  if (roleType == null) return null;
  const r = String(roleType).toLowerCase().trim();
  if (!r || !ALLOWED_ROLES.has(r)) return null;
  return r;
}
