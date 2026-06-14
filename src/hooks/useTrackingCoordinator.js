import { useCallback, useEffect, useRef } from 'react';
import {
  recordActiveSourceTransition,
  recordTrackingDebounceFlush,
  recordTrackingRAFFlush,
  recordTrackingRehydrate,
  recordTrackingSocketEvent
} from './usePerformanceTelemetry.js';

const FLUSH_MAX_MS = 300;
const TRACE_MAX = 64;

/** @type {Array<{ at: number, type: string, detail?: object }>} */
const coordinatorTrace = [];

function pushTrace(entry) {
  coordinatorTrace.push({ at: Date.now(), ...entry });
  while (coordinatorTrace.length > TRACE_MAX) coordinatorTrace.shift();
}

export function getCoordinatorTrace() {
  return coordinatorTrace.slice();
}

export function clearCoordinatorTrace() {
  coordinatorTrace.length = 0;
}

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
    flushHandler: null,
    rehydrateStartedAt: null
  });

  const setActiveSource = useCallback((next, meta = {}) => {
    const prev = stateRef.current.activeSource;
    if (prev === next) return;
    stateRef.current.activeSource = next;
    pushTrace({ type: 'source_switch', detail: { from: prev, to: next, trackRef, ...meta } });
    recordActiveSourceTransition(prev, next);
  }, [trackRef]);

  const resolveSourceAfterRehydrate = useCallback(() => {
    setActiveSource(socketReady && trackingGate ? 'socket' : 'polling', { reason: 'post_rehydrate' });
  }, [socketReady, trackingGate, setActiveSource]);

  const beginRehydrate = useCallback(() => {
    stateRef.current.rehydrateStartedAt = Date.now();
    setActiveSource('rehydrate', { reason: 'begin_rehydrate' });
    pushTrace({ type: 'rehydrate_start', detail: { trackRef } });
    recordTrackingRehydrate();
  }, [setActiveSource, trackRef]);

  const markRehydrated = useCallback(() => {
    const started = stateRef.current.rehydrateStartedAt;
    stateRef.current.lastSyncTimestamp = Date.now();
    stateRef.current.rehydrateStartedAt = null;
    pushTrace({
      type: 'rehydrate_end',
      detail: { trackRef, durationMs: started ? Date.now() - started : null }
    });
    resolveSourceAfterRehydrate();
  }, [resolveSourceAfterRehydrate, trackRef]);

  const shouldAcceptSocketUpdate = useCallback(() => {
    return stateRef.current.activeSource !== 'rehydrate';
  }, []);

  const registerFlushHandler = useCallback((handler) => {
    stateRef.current.flushHandler = handler;
  }, []);

  const flushBufferedUpdate = useCallback((flushReason = 'manual') => {
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
      if (flushReason === 'raf') {
        pushTrace({ type: 'flush_rAF', detail: { trackRef } });
        recordTrackingRAFFlush();
      } else if (flushReason === 'debounce') {
        pushTrace({ type: 'flush_debounce_300ms', detail: { trackRef } });
        recordTrackingDebounceFlush();
      }
      state.flushHandler(pending);
    }
  }, [trackRef]);

  const scheduleBufferedUpdate = useCallback(
    (incoming) => {
      if (!incoming || !shouldAcceptSocketUpdate()) return;
      recordTrackingSocketEvent();
      stateRef.current.pendingUpdate = incoming;
      const state = stateRef.current;
      if (state.rafId) return;
      state.rafId = requestAnimationFrame(() => {
        state.rafId = null;
        flushBufferedUpdate('raf');
      });
      if (!state.maxWaitTimer) {
        state.maxWaitTimer = setTimeout(() => {
          flushBufferedUpdate('debounce');
        }, FLUSH_MAX_MS);
      }
    },
    [shouldAcceptSocketUpdate, flushBufferedUpdate]
  );

  useEffect(() => {
    if (!trackingGate) {
      setActiveSource('polling', { reason: 'gate_closed' });
      return;
    }
    if (stateRef.current.activeSource === 'rehydrate') return;
    setActiveSource(socketReady ? 'socket' : 'polling', { reason: 'gate_or_socket' });
  }, [trackingGate, socketReady, setActiveSource]);

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
