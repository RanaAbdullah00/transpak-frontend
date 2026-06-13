/** Mount-level guard — one rating UI per transaction per session. */

const mounted = new Set();
const locked = new Set();

export function reviewRenderGuard(transactionId) {
  const id = String(transactionId || '').trim();
  if (!id) {
    return {
      allowed: false,
      lock: () => {},
      release: () => {}
    };
  }

  const allowed = !mounted.has(id) && !locked.has(id);

  if (allowed) {
    mounted.add(id);
  }

  return {
    allowed,
    lock: () => {
      locked.add(id);
      mounted.delete(id);
    },
    release: () => {
      mounted.delete(id);
    }
  };
}

export function isReviewRenderLocked(transactionId) {
  const id = String(transactionId || '').trim();
  return id ? locked.has(id) : false;
}

/** Read-only check — does not register a mount. */
export function canRenderReview(transactionId) {
  const id = String(transactionId || '').trim();
  if (!id) return false;
  return !mounted.has(id) && !locked.has(id);
}
