import React from 'react';

/** Shared green star picker for review flows. */
const StarPicker = ({ value = 0, onChange, max = 5, disabled = false }) => (
  <div className="d-flex gap-1 flex-wrap">
    {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
      <button
        key={n}
        type="button"
        className={`btn btn-sm tp-star-btn ${Number(value) >= n ? 'tp-star-on' : 'btn-outline-secondary'}`}
        onClick={() => onChange(n)}
        disabled={disabled}
        aria-label={`${n} stars`}
      >
        ★
      </button>
    ))}
  </div>
);

export default StarPicker;
