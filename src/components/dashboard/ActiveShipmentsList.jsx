import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ActiveShipmentCard from './ActiveShipmentCard.jsx';
import Loader from '../ui/Loader.jsx';
import TrackingSafeBoundary from '../tracking/TrackingSafeBoundary.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { mergeActiveShipmentRows } from '../../utils/activeShipmentModel.js';
import {
  getActiveShipmentList,
  markActiveShipmentStoreBootstrapped,
  upsertActiveShipmentRows
} from '../../utils/activeShipmentStore.js';
import { useActiveShipmentStore } from '../../hooks/useActiveShipmentStore.js';
import {
  assertIsSnapshotConsumer,
  EMPTY_UNIFIED_SNAPSHOT,
  getUnifiedShipmentSnapshot
} from '../../utils/shipmentUIState.js';
import { subscribeOptimisticActivation } from '../../utils/contractActivationLayer.js';

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
  const [activationTick, bumpActivation] = useState(0);
  const hasLoadedRef = useRef(false);

  useEffect(() => subscribeOptimisticActivation(() => bumpActivation((n) => n + 1)), []);

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
      if (scope && scope !== 'shipments' && scope !== 'all') return;
      bootstrap({ silent: hasLoadedRef.current });
    };
    const onShipmentsRefresh = () => bootstrap({ silent: hasLoadedRef.current });
    const onContractActivated = () => bumpActivation((n) => n + 1);
    window.addEventListener('tp:active-shipments-hydrate', onHydrate);
    window.addEventListener('tp:realtime-refresh', onRefresh);
    window.addEventListener('tp:shipments-refresh', onShipmentsRefresh);
    window.addEventListener('tp:contract-activated', onContractActivated);
    return () => {
      window.removeEventListener('tp:active-shipments-hydrate', onHydrate);
      window.removeEventListener('tp:realtime-refresh', onRefresh);
      window.removeEventListener('tp:shipments-refresh', onShipmentsRefresh);
      window.removeEventListener('tp:contract-activated', onContractActivated);
    };
  }, [bootstrap]);

  const rowSnapshots = useMemo(
    () =>
      rows.map((row) => {
        try {
          return assertIsSnapshotConsumer(
            getUnifiedShipmentSnapshot({
              restRow: row,
              ref: row?.trackRef,
              role: carrierMode ? 'carrier' : 'shipper'
            }),
            'ActiveShipmentsList'
          );
        } catch (err) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn('[ActiveShipmentsList] snapshot failed', err);
          }
          return EMPTY_UNIFIED_SNAPSHOT;
        }
      }),
    [rows, carrierMode, activationTick]
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
      {rowSnapshots.filter(Boolean).map((snapshot, idx, arr) => {
        const row = snapshot?.activeRow && typeof snapshot.activeRow === 'object' ? snapshot.activeRow : {};
        const trackRef = String(snapshot?.ref || row?.trackRef || row?.code || '').trim();
        if (!trackRef && !snapshot?.contractActivated) return null;
        const label = `${row.origin || ''} → ${row.destination || ''}`.trim();
        const cardKey = trackRef || `active-${idx}`;
        return (
          <TrackingSafeBoundary key={cardKey} trackRef={trackRef} role={carrierMode ? 'carrier' : 'shipper'}>
            <ActiveShipmentCard
              snapshot={snapshot}
              trackRef={trackRef}
              label={label || trackRef}
              assignedCarrierId={row.assignedCarrierId ?? snapshot?.contractFields?.assignedCarrierId}
              shipperId={row.shipperId ?? snapshot?.contractFields?.shipperId}
              shipperName={row.shipperName}
              carrierName={row.carrierName}
              shipperAvatar={row.shipperAvatar}
              carrierAvatar={row.carrierAvatar}
              shipmentStatus={snapshot?.shipmentStatus ?? row.shipmentStatus}
              flowType={row.flowType ?? snapshot?.contractFields?.flowType}
              trackingEnabled={snapshot?.tracking?.enabled ?? row.trackingEnabled}
              carrierMode={carrierMode}
              shareLive={carrierMode}
              defaultExpanded={idx === 0 && arr.length === 1}
            />
          </TrackingSafeBoundary>
        );
      })}
    </div>
  );
};

export default ActiveShipmentsList;
