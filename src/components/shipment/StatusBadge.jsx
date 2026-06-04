import React, { useMemo } from 'react';
import Badge from '../ui/Badge.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { getShipmentUIState, withShipmentUILabels } from '../../utils/shipmentUIState.js';

// Visual indicator for shipment / tracking status (via shipmentUIState resolver).
const StatusBadge = ({ status, uiState: uiStateProp, role = null, size }) => {
  const { t } = useLanguage();
  const ui = useMemo(() => {
    const base = uiStateProp || getShipmentUIState({ status, role });
    return withShipmentUILabels(base, t);
  }, [uiStateProp, status, role, t]);
  const cls = size === 'lg' ? 'fs-6 px-3 py-2' : '';
  return (
    <Badge variant={ui.color} className={cls}>
      {ui.label}
    </Badge>
  );
};

export default StatusBadge;
