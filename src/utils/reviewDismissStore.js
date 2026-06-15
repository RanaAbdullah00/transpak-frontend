/** Shared session dismiss keys for review prompts (modal + profile tab dedupe). */

export function reviewDismissStorageKey(userId) {
  return userId ? `tp:${userId}:review_dismissed` : 'tp_review_dismissed';
}

export function reviewDismissKeyFromPrompt(p) {
  if (!p) return null;
  if (p.kind === 'space' && p.spaceRequestId) return `space:${p.spaceRequestId}`;
  if (p.loadId) return `load:${p.loadId}`;
  return null;
}

export function loadReviewDismissed(userId) {
  try {
    const raw = sessionStorage.getItem(reviewDismissStorageKey(userId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveReviewDismissed(userId, set) {
  if (!userId) return;
  try {
    sessionStorage.setItem(reviewDismissStorageKey(userId), JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function isReviewDismissed(userId, promptLike) {
  const key = reviewDismissKeyFromPrompt(promptLike);
  if (!key) return false;
  return loadReviewDismissed(userId).has(key);
}

export function markReviewDismissed(userId, promptLike) {
  const key = reviewDismissKeyFromPrompt(promptLike);
  if (!key || !userId) return;
  const set = loadReviewDismissed(userId);
  set.add(key);
  saveReviewDismissed(userId, set);
}

/** Hydrate session dismiss set from server (cross-session persistence). */
export async function hydrateReviewDismissedFromServer(request, userId) {
  if (!userId || typeof request !== 'function') return;
  try {
    const data = await request({ method: 'GET', url: '/reviews/dismissed', skipGlobalErrorToast: true });
    const keys = Array.isArray(data?.keys) ? data.keys : Array.isArray(data) ? data : [];
    if (!keys.length) return;
    const set = loadReviewDismissed(userId);
    keys.forEach((k) => set.add(String(k)));
    saveReviewDismissed(userId, set);
  } catch {
    /* optional endpoint / pre-migration */
  }
}

/** Persist skip preference server-side (best-effort). */
export function persistReviewDismissToServer(request, promptLike) {
  const key = reviewDismissKeyFromPrompt(promptLike);
  if (!key || typeof request !== 'function') return Promise.resolve();
  const loadId = promptLike?.loadId || (key.startsWith('load:') ? key.slice(5) : null);
  const spaceRequestId =
    promptLike?.spaceRequestId || (key.startsWith('space:') ? key.slice(6) : null);
  return request({
    method: 'POST',
    url: '/reviews/dismiss',
    data: { loadId: loadId || undefined, spaceRequestId: spaceRequestId || undefined },
    skipGlobalErrorToast: true
  }).catch(() => {});
}
