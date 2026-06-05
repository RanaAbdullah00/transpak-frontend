import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useAuth } from '../../hooks/useAuth.js';
import { mergeActiveShipmentRows } from '../../utils/activeShipmentModel.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';

const AcceptedLoads = () => {
  const { request, loading } = useApi();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    try {
      const data = await request({
        method: 'GET',
        url: '/shipments/active',
        skipGlobalErrorToast: true
      });
      setRows((prev) => {
        const next = mergeActiveShipmentRows(prev, data, { silent });
        if (next.length) hasLoadedRef.current = true;
        return next;
      });
    } catch {
      if (!silent) setRows([]);
    }
  }, [request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onHydrate = (e) => {
      const nextRows = e?.detail?.rows;
      if (!Array.isArray(nextRows)) return;
      if (!nextRows.length && e?.detail?.pendingRetry) return;
      setRows((prev) => mergeActiveShipmentRows(prev, nextRows));
    };
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope !== 'shipments') return;
      if (e?.detail?.atomicSync) return;
      refresh({ silent: hasLoadedRef.current });
    };
    window.addEventListener('tp:active-shipments-hydrate', onHydrate);
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => {
      window.removeEventListener('tp:active-shipments-hydrate', onHydrate);
      window.removeEventListener('tp:realtime-refresh', onRefresh);
    };
  }, [refresh]);

  const dashboardHref = dashboardPathForRole(user?.activeRole);

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('pages.loads.acceptedLoadsTitle')}</h5>
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center text-muted py-5 px-3 tp-empty-state rounded-3 border border-dashed">
          {t('pages.loads.emptyAcceptedLoads')}
        </div>
      ) : (
        rows.map((row) => (
          <Card key={row.trackRef || row.id} className="p-3 mb-2">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div className="fw-semibold">{row.cargo || row.trackRef}</div>
                <div className="small text-muted">
                  {row.trackRef} · {row.origin} → {row.destination}
                </div>
                <div className="small text-muted mt-1">
                  {t('pages.loads.pickupLabel')}: {row.pickupDate || t('common.emDash')}
                </div>
              </div>
              <Badge variant="success">{row.shipmentStatus || 'booked'}</Badge>
            </div>
            <div className="d-flex justify-content-end mt-2">
              <Link to={dashboardHref} className="btn btn-primary btn-sm">
                {t('pages.dashboard.myActiveShipments')}
              </Link>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default AcceptedLoads;
