import React, { useCallback, useEffect, useState } from 'react';
import ActiveShipmentCard from './ActiveShipmentCard.jsx';
import Loader from '../ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useAuth } from '../../hooks/useAuth.js';
import { shipmentUIStateFromActiveRow } from '../../utils/shipmentUIState.js';

/**
 * Lists all in-progress shipments for the current user (shipper or carrier).
 */
const ActiveShipmentsList = ({ carrierMode = false, emptyState = null }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { request } = useApi();
  const workspaceRole = carrierMode ? 'carrier' : user?.activeRole === 'shipper' ? 'shipper' : null;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request({
        method: 'GET',
        url: '/shipments/active',
        skipGlobalErrorToast: true
      });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'shipments' && scope !== 'loads' && scope !== 'bids') {
        return;
      }
      refresh();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
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
      {rows
        .filter((row) => {
          const ui = shipmentUIStateFromActiveRow(row, workspaceRole);
          return ui.isActive;
        })
        .map((row, idx, arr) => {
          const ref = row.code || row.id;
          const label = `${row.origin || ''} → ${row.destination || ''}`.trim();
          return (
            <ActiveShipmentCard
              key={ref}
              trackRef={ref}
              label={label || ref}
              assignedCarrierId={row.assignedCarrierId}
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
