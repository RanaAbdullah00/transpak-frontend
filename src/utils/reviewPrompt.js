/** Queue a post-completion review modal (load shipment or space contract). */
export function emitReviewPrompt(detail) {
  if (typeof window === 'undefined' || !detail?.toUserId) return;
  window.dispatchEvent(new CustomEvent('tp:review-prompt', { detail }));
}
