import { useCallback, useEffect, useRef } from 'react';

const FLUSH_MAX_MS = 300;

/**
 * Per-ref tracking update coordinator — single active source, batched socket applies.
 */
export function useTrackingCoordinator(trackRef, { socketReady = false, trackingGate = false } = {}) {
  const stateRef = useRef({
    activeSource: 'polling',
    lastSyncTimestamp: 0,
    pendingUpdate: null,
    rafId: null,
    maxWaitTimer: null,
    flushHandler: null
  });

  const resolveSourceAfterRehydrate = useCallback(() => {
    stateRef.current.activeSource = socketReady && trackingGate ? 'socket' : 'polling';
  }, [socketReady, trackingGate]);

  const beginRehydrate = useCallback(() => {
    stateRef.current.activeSource = 'rehydrate';
  }, []);

  const markRehydrated = useCallback(() => {
    stateRef.current.lastSyncTimestamp = Date.now();
    resolveSourceAfterRehydrate();
  }, [resolveSourceAfterRehydrate]);

  const shouldAcceptSocketUpdate = useCallback(() => {
    return stateRef.current.activeSource !== 'rehydrate';
  }, []);

  const registerFlushHandler = useCallback((handler) => {
    stateRef.current.flushHandler = handler;
  }, []);

  const flushBufferedUpdate = useCallback(() => {
    const state = stateRef.current;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    if (state.maxWaitTimer) {
      clearTimeout(state.maxWaitTimer);
      state.maxWaitTimer = null;
    }
    const pending = state.pendingUpdate;
    state.pendingUpdate = null;
    if (pending && state.flushHandler) {
      state.flushHandler(pending);
    }
  }, []);

  const scheduleBufferedUpdate = useCallback(
    (incoming) => {
      if (!incoming || !shouldAcceptSocketUpdate()) return;
      stateRef.current.pendingUpdate = incoming;
      const state = stateRef.current;
      if (state.rafId) return;
      state.rafId = requestAnimationFrame(() => {
        state.rafId = null;
        flushBufferedUpdate();
      });
      if (!state.maxWaitTimer) {
        state.maxWaitTimer = setTimeout(() => {
          flushBufferedUpdate();
        }, FLUSH_MAX_MS);
      }
    },
    [shouldAcceptSocketUpdate, flushBufferedUpdate]
  );

  useEffect(() => {
    if (!trackingGate) {
      stateRef.current.activeSource = 'polling';
      return;
    }
    if (stateRef.current.activeSource === 'rehydrate') return;
    stateRef.current.activeSource = socketReady ? 'socket' : 'polling';
  }, [trackingGate, socketReady]);

  useEffect(() => {
    return () => {
      const state = stateRef.current;
      if (state.rafId) cancelAnimationFrame(state.rafId);
      if (state.maxWaitTimer) clearTimeout(state.maxWaitTimer);
      state.pendingUpdate = null;
      state.flushHandler = null;
    };
  }, [trackRef]);

  return {
    beginRehydrate,
    markRehydrated,
    shouldAcceptSocketUpdate,
    scheduleBufferedUpdate,
    registerFlushHandler,
    flushBufferedUpdate
  };
}
