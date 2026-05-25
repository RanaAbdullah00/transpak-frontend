import { useEffect, useRef, useState } from 'react';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Smoothly animate [lat, lng] marker position (reduces GPS jumpiness).
 * @param {[number, number]|null} target
 * @param {{ durationMs?: number }} [opts]
 */
export function useSmoothCoords(target, { durationMs = 700 } = {}) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!target || !Array.isArray(target) || target.length < 2) {
      setDisplay(null);
      fromRef.current = null;
      return undefined;
    }

    const to = [Number(target[0]), Number(target[1])];
    if (!Number.isFinite(to[0]) || !Number.isFinite(to[1])) return undefined;

    const from = fromRef.current || to;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = t * (2 - t);
      const next = [lerp(from[0], to[0], eased), lerp(from[1], to[1], eased)];
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target?.[0], target?.[1], durationMs]);

  return display;
}
