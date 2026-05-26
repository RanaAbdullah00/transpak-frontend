import { useEffect, useRef } from 'react';

/**
 * setInterval that skips stale callbacks after unmount and supports dynamic delay.
 */
export function useSafeInterval(callback, delayMs, { enabled = true } = {}) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled || delayMs == null || delayMs <= 0) return undefined;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) saved.current();
    };
    tick();
    const id = window.setInterval(tick, delayMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [delayMs, enabled]);
}
