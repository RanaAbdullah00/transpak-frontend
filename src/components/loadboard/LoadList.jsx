import React, { memo } from 'react';
import { FaBoxOpen } from 'react-icons/fa';
import LoadCard from './LoadCard.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

// Vertical list of load cards with mobile spacing.
const LoadList = memo(({
  loads,
  onBid,
  carrierMode = false,
  onCarrierAccept,
  onCarrierCounter,
  onCarrierReject,
  carrierBusyLoadId = null
}) => {
  const { t } = useLanguage();
  const safeLoads = Array.isArray(loads) ? loads : [];
  if (!safeLoads.length) {
    return (
      <EmptyState
        icon={FaBoxOpen}
        title={t('empty.loadsTitle')}
        body={t('empty.loadsBody')}
      />
    );
  }

  return (
    <div className="mt-2">
      {safeLoads.map((load) => (
        <LoadCard
          key={load.id}
          load={load}
          onBid={onBid}
          carrierMode={carrierMode}
          onCarrierAccept={onCarrierAccept}
          onCarrierCounter={onCarrierCounter}
          onCarrierReject={onCarrierReject}
          carrierBusy={carrierBusyLoadId != null && String(carrierBusyLoadId) === String(load.id)}
        />
      ))}
    </div>
  );
});

LoadList.displayName = 'LoadList';

export default LoadList;

