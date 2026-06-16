/** Debounced refresh for realtime event fan-out (avoids triple-fetch on single accept). */
export function createDebouncedRefresh(fn, ms = 300) {
  let timer = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void fn();
    }, ms);
  };
}
