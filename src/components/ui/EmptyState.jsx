import React, { memo } from 'react';

/**
 * Consistent empty list / panel state.
 */
const EmptyState = memo(({
  icon: Icon,
  title,
  body,
  action = null,
  className = ''
}) => (
  <div
    className={`text-center py-5 px-3 tp-empty-state rounded-3 border border-dashed tp-border-theme ${className}`.trim()}
    role="status"
  >
    {Icon ? (
      <div className="tp-empty-state__icon d-inline-flex align-items-center justify-content-center rounded-circle mb-3">
        <Icon size={22} aria-hidden />
      </div>
    ) : null}
    <div className="fw-semibold text-body mb-1">{title}</div>
    {body ? <p className="small text-muted mb-0 mx-auto" style={{ maxWidth: '22rem' }}>{body}</p> : null}
    {action ? <div className="mt-3">{action}</div> : null}
  </div>
));

EmptyState.displayName = 'EmptyState';

export default EmptyState;
