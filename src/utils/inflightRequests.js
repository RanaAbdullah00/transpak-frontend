/** Cancel in-flight HTTP when session/workspace changes. */

const controllers = new Set();

export function trackInflight(controller) {
  if (controller) controllers.add(controller);
  return () => controllers.delete(controller);
}

export function abortAllInflight() {
  controllers.forEach((c) => {
    try {
      c.abort();
    } catch {
      /* ignore */
    }
  });
  controllers.clear();
}

export function createTrackedSignal(external) {
  const controller = new AbortController();
  const cleanup = trackInflight(controller);
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const signal = controller.signal;
  signal._tpCleanup = cleanup;
  return signal;
}
