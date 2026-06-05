import { sanitizeProductText } from './userErrors.js';

let flashTimer = null;
let originalTitle = '';
let flashOn = false;
const focusBurstAt = new Map();
const FOCUS_BURST_MS = 2000;

function isTabHidden() {
  return typeof document !== 'undefined' && document.hidden;
}

export function notifyFocusAttention(notification = {}) {
  if (typeof document === 'undefined') return;
  if (!isTabHidden()) return;

  const burstKey =
    notification.globalEventId ||
    notification.dedupeKey ||
    notification.id ||
    notification.title;  const now = Date.now();
  if (now - (focusBurstAt.get(burstKey) || 0) < FOCUS_BURST_MS) return;
  focusBurstAt.set(burstKey, now);

  const priority = String(notification.priority || 'low');
  const shouldFocus = Boolean(notification.focus) || priority === 'high';

  if (shouldFocus) {
    if (!originalTitle) originalTitle = document.title;
    if (flashTimer) window.clearInterval(flashTimer);
    flashOn = true;
    let toggle = false;
    flashTimer = window.setInterval(() => {
      toggle = !toggle;
      const flashLabel = sanitizeProductText(notification.title) || 'TransPAK';
      document.title = toggle ? `• ${flashLabel}` : originalTitle;
    }, 900);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(priority === 'high' ? [80, 40, 80] : 40);
      } catch {
        /* unsupported */
      }
    }
  }
}

export function clearFocusAttention() {
  if (typeof document === 'undefined') return;
  if (flashTimer) {
    window.clearInterval(flashTimer);
    flashTimer = null;
  }
  if (originalTitle) {
    document.title = originalTitle;
    originalTitle = '';
  }
  flashOn = false;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) clearFocusAttention();
  });
}
