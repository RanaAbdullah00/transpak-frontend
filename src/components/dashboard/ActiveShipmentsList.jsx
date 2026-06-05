import React, { useCallback, useEffect, useState } from 'react';
import ActiveShipmentCard from './ActiveShipmentCard.jsx';
import Loader from '../ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { normalizeActiveShipmentList } from '../../utils/activeShipmentModel.js';
import { handleShipmentActivationSync } from '../../utils/contractActivation.js';

/**
 * Active shipments — sole source of truth: GET /shipments/active.
 * State updates via handleShipmentActivationSync hydrate only.
 */
const ActiveShipmentsList = ({ carrierMode = false, emptyState = null }) => {
  const { t } = useLanguage();
  const { request } = useApi();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await request({
        method: 'GET',
        url: '/shipments/active',
        skipGlobalErrorToast: true
      });
      setRows(normalizeActiveShipmentList(data));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void handleShipmentActivationSync(null, { force: true });
  }, []);

  useEffect(() => {
    const onHydrate = (e) => {
      const nextRows = e?.detail?.rows;
      if (!Array.isArray(nextRows)) return;
      if (!nextRows.length && e?.detail?.pendingRetry) return;
      setRows(nextRows);
      setLoading(false);
    };
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope !== 'shipments') return;
      if (e?.detail?.atomicSync) return;
      refresh();
    };
    window.addEventListener('tp:active-shipments-hydrate', onHydrate);
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => {
      window.removeEventListener('tp:active-shipments-hydrate', onHydrate);
      window.removeEventListener('tp:realtime-refresh', onRefresh);
    };
  }, [refresh]);

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
