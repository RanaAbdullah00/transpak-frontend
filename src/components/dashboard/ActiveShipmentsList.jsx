import React, { useCallback, useEffect, useRef, useState } from 'react';
import ActiveShipmentCard from './ActiveShipmentCard.jsx';
import Loader from '../ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { mergeActiveShipmentRows } from '../../utils/activeShipmentModel.js';
import {
  getActiveShipmentList,
  markActiveShipmentStoreBootstrapped,
  upsertActiveShipmentRows
} from '../../utils/activeShipmentStore.js';
import { useActiveShipmentStore } from '../../hooks/useActiveShipmentStore.js';

/**
 * Active shipments — read model: ActiveShipmentStore.
 * Bootstrap + socket refresh: GET /shipments/active (cold start / gap recovery).
 * Runtime activation: hydrate pipeline → store.
 */
const ActiveShipmentsList = ({ carrierMode = false, emptyState = null }) => {
  const { t } = useLanguage();
  const { request } = useApi();
  const { rows } = useActiveShipmentStore();
  const [bootLoading, setBootLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const bootstrap = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent && !hasLoadedRef.current) setBootLoading(true);
      try {
        const data = await request({
          method: 'GET',
          url: '/shipments/active',
          skipGlobalErrorToast: true
        });
        const prior = getActiveShipmentList();
        const merged = mergeActiveShipmentRows(prior, data, { silent });
        if (merged.length) hasLoadedRef.current = true;
        upsertActiveShipmentRows(merged, { authoritative: !silent, source: 'bootstrap' });
        markActiveShipmentStoreBootstrapped();
      } catch {
        if (!hasLoadedRef.current && !silent) {
          upsertActiveShipmentRows([], { authoritative: true, source: 'bootstrap' });
        }
      } finally {
        setBootLoading(false);
      }
    },
    [request]
  );

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const onHydrate = () => {
      hasLoadedRef.current = true;
      setBootLoading(false);
    };
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope !== 'shipments') return;
      if (e?.detail?.atomicSync) return;
      bootstrap({ silent: hasLoadedRef.current });
    };
    window.addEventListener('tp:active-shipments-hydrate', onHydrate);
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => {
      window.removeEventListener('tp:active-shipments-hydrate', onHydrate);
      window.removeEventListener('tp:realtime-refresh', onRefresh);
    };
  }, [bootstrap]);

  const loading = bootLoading && !hasLoadedRef.current && !rows.length;

  if (loading) {
    return (
      <div className="text-center py-4">
        <Loader />
      </div>
    );
  }

  if (!rows.length) {
    return emptyState;
  }

  return (
    <div className="tp-active-shipments-list">
      {rows.length > 1 ? (
        <p className="small text-muted mb-2">
          {t('pages.dashboard.activeShipmentsCount', { count: rows.length })}
        </p>
      ) : null}
      {rows.map((row, idx, arr) => {
        const label = `${row.origin || ''} → ${row.destination || ''}`.trim();
        return (
          <ActiveShipmentCard
            key={row.trackRef || row.id}
            trackRef={row.trackRef}
            label={label || row.trackRef}
            assignedCarrierId={row.assignedCarrierId}
            shipmentStatus={row.shipmentStatus}
            flowType={row.flowType}
            trackingEnabled={row.trackingEnabled}
            carrierMode={carrierMode}
            shareLive={carrierMode}
            defaultExpanded={idx === 0 && arr.length === 1}
          />
        );
      })}
    </div>
  );
};

export default ActiveShipmentsList;
