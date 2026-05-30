/** Debounced 401 recovery — prevents refresh/logout storms from parallel API failures. */

let debounceTimer = null;
let lastDispatchAt = 0;
const MIN_GAP_MS = 6000;

export function dispatchAuthUnauthorized() {
  const now = Date.now();
  if (now - lastDispatchAt < MIN_GAP_MS) return;
  if (debounceTimer) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    lastDispatchAt = Date.now();
    window.dispatchEvent(new CustomEvent('tp:auth-unauthorized'));
  }, 400);
}
