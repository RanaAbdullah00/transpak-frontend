import React, { useRef } from 'react';

const pulse = {
  animation: 'tp-skeleton-pulse 1.2s ease-in-out infinite',
  backgroundColor: 'var(--bs-secondary-bg, #e9ecef)'
};

function useStableKeys(count) {
  const ref = useRef({ n: 0, keys: /** @type {string[]} */ ([]) });
  if (ref.current.n !== count) {
    ref.current = {
      n: count,
      keys: Array.from({ length: count }, () => crypto.randomUUID())
    };
  }
  return ref.current.keys;
}

export function SkeletonLine({ className = '', height = 12, width = '100%' }) {
  return (
    <div
      className={`rounded-2 ${className}`}
      style={{ ...pulse, height, width, minHeight: height }}
      aria-hidden
    />
  );
}

export function SkeletonCard({ rows = 3 }) {
  const lineKeys = useStableKeys(rows);
  return (
    <div className="card border-0 shadow-sm rounded-3 overflow-hidden mb-3">
      <div className="card-body p-3">
        <SkeletonLine height={14} width="40%" className="mb-3" />
        {lineKeys.map((k, i) => (
          <SkeletonLine
            key={k}
            height={10}
            width={i === rows - 1 ? '60%' : '100%'}
            className="mb-2"
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ cols = 5, rows = 6 }) {
  const colKeys = useStableKeys(cols);
  const rowKeys = useStableKeys(rows);
  return (
    <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
      <div className="table-responsive">
        <table className="table mb-0">
          <thead className="table-light">
            <tr>
              {colKeys.map((colKey) => (
                <th key={colKey} className="py-3">
                  <SkeletonLine height={10} width="70%" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((rowKey) => (
              <tr key={rowKey}>
                {colKeys.map((colKey, ci) => (
                  <td key={`${rowKey}:${colKey}`} className="py-3">
                    <SkeletonLine height={10} width={ci === colKeys.length - 1 ? '50%' : '85%'} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SkeletonStatCards({ count = 4 }) {
  const cardKeys = useStableKeys(count);
  return (
    <div className="row g-3">
      {cardKeys.map((k) => (
        <div key={k} className="col-12 col-md-6 col-xl-4">
          <div className="card border-0 shadow-sm h-100 rounded-3">
            <div className="card-body py-4">
              <SkeletonLine height={10} width="50%" className="mb-3" />
              <SkeletonLine height={28} width="35%" className="mb-2" />
              <SkeletonLine height={12} width="70%" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
