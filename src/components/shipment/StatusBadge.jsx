import React, { useMemo } from 'react';
import Badge from '../ui/Badge.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { sanitizeBadgeVariant } from '../../utils/badgeVariants.js';
import { normalizeContractFields } from '../../utils/contractFieldNormalizer.js';
import { getShipmentUIState, withShipmentUILabels } from '../../utils/shipmentUIState.js';

// Visual indicator for shipment / tracking status (via shipmentUIState resolver).
const StatusBadge = ({ status, uiState: uiStateProp, role = null, bidStatus = null, size }) => {
  const { t } = useLanguage();
  const ui = useMemo(() => {
    const base =
      uiStateProp ||
      getShipmentUIState(
        normalizeContractFields({
          status,
          role,
          bidStatus
        })
      );
    return withShipmentUILabels(base, t);
  }, [uiStateProp, status, role, bidStatus, t]);
  const cls = size === 'lg' ? 'fs-6 px-3 py-2' : '';
  const safeLabel = ui.label && ui.label !== 'undefined' ? ui.label : '—';
  return (
    <Badge variant={sanitizeBadgeVariant(ui.color || ui.colorVariant)} className={cls}>
      {safeLabel}
    </Badge>
  );
};

export default StatusBadge;
