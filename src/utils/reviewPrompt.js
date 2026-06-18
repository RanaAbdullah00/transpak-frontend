/** Queue a post-completion review modal (load shipment or space contract). */
export function emitReviewPrompt(detail) {
  if (typeof window === 'undefined' || !detail?.toUserId) return;
  window.dispatchEvent(new CustomEvent('tp:review-prompt', { detail }));
}

/** Socket / notification bridge — fetch pending reviews or emit when counterparty is known. */
export function emitReviewPromptSync(dispatch = {}) {
  if (typeof window === 'undefined') return;
  const payload =
    (dispatch.payload && typeof dispatch.payload === 'object' ? dispatch.payload : null) ||
    (dispatch.notification && typeof dispatch.notification === 'object' ? dispatch.notification : null) ||
    {};
  const senderId = String(
    dispatch.senderId || payload.senderId || dispatch.notification?.senderId || ''
  ).trim();
  const loadCode = String(payload.loadCode || payload.ref || payload.shipmentRef || '').trim();
  const loadId = payload.loadId || payload.entityId || null;
  const roleType = String(dispatch.roleType || payload.roleType || '').toLowerCase();

  if (senderId && loadCode) {
    emitReviewPrompt({
      kind: 'load',
      toUserId: senderId,
      shipmentRef: loadCode,
      loadId,
      roleType: roleType === 'shipper' ? 'carrier' : roleType === 'carrier' ? 'shipper' : undefined
    });
  }

  window.dispatchEvent(new CustomEvent('tp:review-prompt-sync'));
}
