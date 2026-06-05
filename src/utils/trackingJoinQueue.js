/**
 * In-memory queue for tracking:join when canTrack is true but socket is not ready.
 */

const pending = new Map();

function keyOf(ref) {
  return String(ref || '').trim();
}

/**
 * @param {string} primaryRef
 * @param {string[]} aliasRefs
 */
export function requestTrackingJoin(primaryRef, aliasRefs = []) {
  const key = keyOf(primaryRef);
  if (!key) return;

  let row = pending.get(key);
  if (!row) {
    row = { aliases: new Set(), requestedAt: Date.now() };
    pending.set(key, row);
  }
  row.aliases.add(key);
  aliasRefs.forEach((a) => {
    const ak = keyOf(a);
    if (ak) row.aliases.add(ak);
  });
}

export function clearTrackingJoinRequest(primaryRef) {
  const key = keyOf(primaryRef);
  if (key) pending.delete(key);
}

export function getPendingTrackingJoins() {
  return [...pending.entries()].map(([key, row]) => ({
    key,
    aliases: [...row.aliases]
  }));
}

/**
 * Flush pending joins when socket is connected (immediate + optional delayed retry).
 * @param {import('socket.io-client').Socket|null} socket
 * @param {(socket: import('socket.io-client').Socket, ref: string, aliases: string[]) => void} emitJoin
 * @param {{ delayRetryMs?: number }} [opts]
 */
export function flushTrackingJoinQueue(socket, emitJoin, opts = {}) {
  if (!socket?.connected || typeof emitJoin !== 'function') return;

  getPendingTrackingJoins().forEach(({ key, aliases }) => {
    emitJoin(socket, key, aliases.filter((a) => a !== key));
    pending.delete(key);
  });

  const delay = opts.delayRetryMs ?? 0;
  if (delay > 0) {
    window.setTimeout(() => {
      if (!socket?.connected) return;
      getPendingTrackingJoins().forEach(({ key, aliases }) => {
        emitJoin(socket, key, aliases.filter((a) => a !== key));
        pending.delete(key);
      });
    }, delay);
  }
}

export function clearTrackingJoinQueue() {
  pending.clear();
}
