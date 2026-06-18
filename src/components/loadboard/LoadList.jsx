import React, { memo, useMemo } from 'react';
import { FaBoxOpen } from 'react-icons/fa';
import LoadCard from './LoadCard.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useRatingSummaryBatch } from '../../hooks/useRatingSummaryBatch.js';
import VirtualListBody from '../ui/VirtualListBody.jsx';

// Vertical list of load cards with mobile spacing.
const LoadList = memo(({
  loads,
  onBid,
  carrierMode = false,
  onCarrierAccept,
  onCarrierReject,
  carrierBusyLoadId = null
}) => {
  const { t } = useLanguage();
  const safeLoads = Array.isArray(loads) ? loads : [];
  const ratingUserIds = useMemo(() => {
    const ids = new Set();
    for (const load of safeLoads) {
      if (load?.shipperId) ids.add(String(load.shipperId));
    }
    return [...ids];
  }, [safeLoads]);
  const { ratingMap, loading: ratingsLoading } = useRatingSummaryBatch(ratingUserIds);
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
    <VirtualListBody
      className="mt-2"
      items={safeLoads}
      itemHeight={156}
      getItemKey={(load) => load.id}
      renderItem={(load) => (
        <LoadCard
          load={load}
          onBid={onBid}
          carrierMode={carrierMode}
          onCarrierAccept={onCarrierAccept}
          onCarrierReject={onCarrierReject}
          carrierBusy={carrierBusyLoadId != null && String(carrierBusyLoadId) === String(load.id)}
          ratingMap={ratingMap}
          ratingsLoading={ratingsLoading}
        />
      )}
    />
  );
});

LoadList.displayName = 'LoadList';

export default LoadList;

