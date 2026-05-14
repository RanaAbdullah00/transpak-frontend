import React from 'react';
import Badge from '../ui/Badge.jsx';
import { normalizeShipmentStatus } from '../../utils/shipmentStatus.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { translateShipmentOrLoadStatus } from '../../utils/i18nLabels.js';

// Visual indicator for shipment / tracking status.
const StatusBadge = ({ status, size }) => {
  const { t } = useLanguage();
  const canon = normalizeShipmentStatus(status) || String(status || '').toLowerCase();
  const map = {
    posted: 'secondary',
    booked: 'warning',
    pickedup: 'warning',
    intransit: 'primary',
    delivered: 'success',
    closed: 'secondary',
    pending: 'warning',
    in_transit: 'primary',
    cancelled: 'secondary'
  };
  const variant = map[canon] || map[String(status || '').toLowerCase()] || 'secondary';
  const label = translateShipmentOrLoadStatus(t, status);
  const cls = size === 'lg' ? 'fs-6 px-3 py-2' : '';
  return (
    <Badge variant={variant} className={cls}>
      {label}
    </Badge>
  );
};

export default StatusBadge;
