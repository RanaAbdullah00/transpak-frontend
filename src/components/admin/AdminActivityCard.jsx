import React from 'react';

const ICONS = {
  load: '📦',
  bid: '💰',
  shipment: '🚚',
  audit: '📋',
  system: '⚙️',
  default: '•'
};

/**
 * Single admin activity / audit row with status-colored left glow.
 */
const AdminActivityCard = ({
  label,
  detail,
  meta,
  timestamp,
  variant = 'info',
  icon,
  pulse = false,
  badge = null
}) => {
  const glyph = icon || ICONS[variant] || ICONS.default;
  return (
    <li
      className={`tp-admin-activity-card tp-admin-activity--${variant}${pulse ? ' tp-admin-activity--pulse' : ''}`}
    >
      <div className="tp-admin-activity-card__icon" aria-hidden="true">
        {glyph}
      </div>
      <div className="tp-admin-activity-card__body min-w-0">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <div className="small fw-semibold text-break">{label}</div>
          <div className="small text-muted text-nowrap flex-shrink-0">{timestamp}</div>
        </div>
        {detail ? <div className="small text-muted text-truncate">{detail}</div> : null}
        {meta ? <div className="small text-body-secondary">{meta}</div> : null}
        {badge ? (
          <span className={`badge rounded-pill tp-admin-activity-badge tp-admin-activity-badge--${variant}`}>
            {badge}
          </span>
        ) : null}
      </div>
    </li>
  );
};

export default AdminActivityCard;
