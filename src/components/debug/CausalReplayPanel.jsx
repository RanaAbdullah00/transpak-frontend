import { useCausalReplay } from '../../hooks/useCausalReplay.js';

function CausalBranch({ eventId, nodes, depth = 0 }) {
  const node = nodes?.[eventId];
  if (!node) return null;
  const children = node.children || [];
  return (
    <li style={{ marginLeft: depth * 12, listStyle: 'none' }}>
      <span>
        {eventId} (seq {node.sequenceId ?? '?'}, {node.causalityType ?? '?'})
      </span>
      {children.length > 0 && (
        <ul style={{ paddingLeft: 0 }}>
          {children.map((childId) => (
            <CausalBranch key={childId} eventId={childId} nodes={nodes} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * DEV-only read-only causal chain viewer.
 */
export default function CausalReplayPanel({ shipmentId }) {
  const { data, loading, error } = useCausalReplay(shipmentId, {
    enabled: import.meta.env.DEV && Boolean(shipmentId)
  });

  if (!import.meta.env.DEV || !shipmentId) return null;

  const causal = data?.causal;
  const nodes = causal?.nodes || {};
  const roots = causal?.roots || [];

  return (
    <details
      className="tp-causal-replay-panel"
      style={{
        marginTop: 12,
        padding: 10,
        background: 'var(--surface-muted, #f8fafc)',
        borderRadius: 8,
        fontSize: 12
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Causal replay (DEV)</summary>
      {loading && <p>Loading replay…</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {!loading && causal && (
        <>
          <p>
            events: {data?.count ?? 0} · corrections: {(causal.corrections || []).length} ·
            divergence: {(causal.divergencePoints || []).length}
          </p>
          <ul style={{ paddingLeft: 0 }}>
            {roots.map((rootId) => (
              <CausalBranch key={rootId} eventId={rootId} nodes={nodes} />
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
