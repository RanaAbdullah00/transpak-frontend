import React from 'react';
import Button from './Button.jsx';

/**
 * Simple offset pagination for admin list pages.
 */
export default function Pagination({ page, totalPages, onPageChange, className = '' }) {
  const p = Math.max(1, Number(page) || 1);
  const tp = Math.max(1, Number(totalPages) || 1);
  if (tp <= 1) return null;

  return (
    <div className={`d-flex align-items-center justify-content-between gap-2 flex-wrap ${className}`}>
      <span className="small text-muted">
        Page {p} of {tp}
      </span>
      <div className="d-flex gap-2">
        <Button
          variant="outline-secondary"
          size="sm"
          disabled={p <= 1}
          onClick={() => onPageChange(p - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          disabled={p >= tp}
          onClick={() => onPageChange(p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
