import { lazy } from 'react';

/**
 * Lazy import with one retry — recovers from dev HMR / stale chunk failures.
 * @param {() => Promise<{ default: React.ComponentType }>} importFn
 */
export function lazyWithRetry(importFn, retries = 1) {
  return lazy(async () => {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await importFn();
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }
    throw lastErr;
  });
}
