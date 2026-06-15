import { getCoordinatorTrace } from '../../hooks/useTrackingCoordinator.js';
import { useCausalReplay } from '../../hooks/useCausalReplay.js';

function lastCorrectionFromReplay(replay) {
  const corrections = replay?.causal?.corrections || [];
  if (!corrections.length) return null;
  const lastId = corrections[corrections.length - 1];
  const node = replay?.causal?.nodes?.[lastId];
  return node ? { eventId: lastId, ...node } : { eventId: lastId };
}

/**
 * DEV-only overlay — activeSource, sequenceId, corrections, rehydrate state.
 */
export default function TrackingDebugOverlay({ payload, shipmentId }) {
  const { data: replayData } = useCausalReplay(shipmentId, {
    enabled: import.meta.env.DEV && Boolean(shipmentId)
  });

  if (!import.meta.env.DEV) return null;

  const trace = getCoordinatorTrace();
  const lastTrace = trace[trace.length - 1];
  const activeSource =
    lastTrace?.detail?.activeSource ||
    lastTrace?.detail?.source ||
    payload?.source ||
    'unknown';
  const sequenceId = payload?.sequenceId ?? payload?.tracking?.sequenceId ?? null;
  const correction = lastCorrectionFromReplay(replayData);
  const rehydrate = trace.filter((t) => t.type?.includes('rehydrate')).slice(-1)[0];

  return (
    <div
      className="tp-debug-overlay"
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 9999,
        background: 'rgba(15,23,42,0.92)',
        color: '#e2e8f0',
        fontSize: 11,
        fontFamily: 'monospace',
        padding: '8px 10px',
        borderRadius: 6,
        maxWidth: 280,
        pointerEvents: 'none',
        lineHeight: 1.4
      }}
    >
      <strong style={{ display: 'block', marginBottom: 4 }}>Phase 7 Debug</strong>
      <div>activeSource: {String(activeSource)}</div>
      <div>sequenceId: {sequenceId != null ? String(sequenceId) : '—'}</div>
      <div>lastCorrection: {correction?.eventId || '—'}</div>
      <div>rehydrate: {rehydrate?.type || '—'}</div>
      <div>traceId: {payload?.traceId || '—'}</div>
    </div>
  );
}
