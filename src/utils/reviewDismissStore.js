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
