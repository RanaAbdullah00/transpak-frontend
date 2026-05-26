import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaHistory } from 'react-icons/fa';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { SkeletonCard } from '../../components/ui/Skeleton.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError } from '../../components/ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import VehicleTypeLabel from '../../components/loadboard/VehicleTypeLabel.jsx';

const COMPLETED_STATUSES = new Set(['closed', 'delivered']);

async function fetchCompletedShipments(request, roles) {
  try {
    const data = await request({ url: '/shipments/completed', skipGlobalErrorToast: true });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    const status = err?.response?.status;
    const notFound =
      status === 404 || String(err?.response?.data?.code || '').toUpperCase() === 'NOT_FOUND';
    if (!notFound) throw err;

    // Until GET /shipments/completed is deployed, shippers can fall back to /loads/mine.
    if (roles.includes('shipper')) {
      const mine = await request({ url: '/loads/mine', skipGlobalErrorToast: true });
      return (Array.isArray(mine) ? mine : []).filter((l) =>
        COMPLETED_STATUSES.has(String(l.status || '').toLowerCase())
      );
    }
    return [];
  }
}

const ShipmentHistory = () => {
  const { request, loading } = useApi();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchCompletedShipments(request, roles);
        if (alive) setRows(data);
      } catch (err) {
        if (alive) {
          setRows([]);
          notifyError(formatUserError(err, t, { fallback: t('pages.shipments.historyLoadFailed') }));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [request, roles.join(',')]);

  return (
    <div className="container py-3">
      <h5 className="mb-1">{t('pages.shipments.historyTitle')}</h5>
      <p className="small text-muted mb-3">{t('pages.shipments.historyLead')}</p>
      {loading ? (
        <>
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FaHistory}
          title={t('empty.shipmentsTitle')}
          body={t('empty.shipmentsBody')}
        />
      ) : (
        rows.map((row) => (
          <Card key={row.id} className="p-3 mb-2">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div className="fw-semibold">{row.cargo || row.code}</div>
                <div className="small text-muted">
                  {row.code} · {row.origin} → {row.destination}
                </div>
                <div className="small text-muted mt-1">
                  <VehicleTypeLabel value={row.vehicleType} />
                  {row.pickupDate ? (
                    <span>
                      {' '}
                      · {t('pages.loads.pickupLabel')}: {row.pickupDate}
                    </span>
                  ) : null}
                </div>
              </div>
              <Badge variant="success">{t('pages.shipments.historyClosedLabel')}</Badge>
            </div>
            <div className="d-flex justify-content-end mt-2">
              <Link
                to={`/shipments/tracking/${encodeURIComponent(row.code || row.id)}`}
                className="btn btn-outline-primary btn-sm rounded-lg"
              >
                {t('pages.shipments.historyView')}
              </Link>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default ShipmentHistory;
