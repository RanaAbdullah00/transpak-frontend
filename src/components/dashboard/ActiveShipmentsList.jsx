import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { assertIsSnapshotConsumer, getUnifiedShipmentSnapshot } from '../../utils/shipmentUIState.js';

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

  const rowSnapshots = useMemo(
    () =>
      rows.map((row) =>
        assertIsSnapshotConsumer(
          getUnifiedShipmentSnapshot({
            restRow: row,
            ref: row?.trackRef,
            role: carrierMode ? 'carrier' : 'shipper'
          }),
          'ActiveShipmentsList'
        )
      ),
    [rows, carrierMode]
  );

  const loading = bootLoading && !hasLoadedRef.current;

  if (loading && !rows.length) {
    return (
      <div className="text-center py-4">
        <Loader />
      </div>
    );
  }

  if (!rows.length) {
    return emptyState ?? (
      <div className="text-muted text-center py-4 small">{t('pages.dashboard.emptyNoActiveShipments')}</div>
    );
  }

  return (
    <div className="tp-active-shipments-list">
      {rows.length > 1 ? (
        <p className="small text-muted mb-2">
          {t('pages.dashboard.activeShipmentsCount', { count: rows.length })}
        </p>
      ) : null}
      {rowSnapshots.map((snapshot, idx, arr) => {
        const row = snapshot.activeRow ?? {};
        const label = `${row.origin || ''} → ${row.destination || ''}`.trim();
        return (
          <ActiveShipmentCard
            key={snapshot.ref || row.trackRef || row.id}
            snapshot={snapshot}
            trackRef={snapshot.ref || row.trackRef}
            label={label || snapshot.ref || row.trackRef}
            assignedCarrierId={row.assignedCarrierId ?? snapshot.contractFields?.assignedCarrierId}
            shipmentStatus={snapshot.shipmentStatus ?? row.shipmentStatus}
            flowType={row.flowType ?? snapshot.contractFields?.flowType}
            trackingEnabled={snapshot.tracking?.enabled ?? row.trackingEnabled}
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
