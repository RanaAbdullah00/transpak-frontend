import React, { useCallback, useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import SafeImage from '../../components/ui/SafeImage.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { fleetStatusBadgeClass, normalizeFleetListResponse } from '../../utils/fleetApi.js';

const AdminFleetQueue = () => {
  const { request, loading } = useApi();
  const { t } = useLanguage();
  const [trucks, setTrucks] = useState([]);
  const [total, setTotal] = useState(0);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await request({
        url: '/admin/fleet/trucks',
        params: { status: 'pending', pageSize: 50 }
      });
      const { items, total: n } = normalizeFleetListResponse(data);
      setTrucks(items);
      setTotal(n);
    } catch {
      setTrucks([]);
      setTotal(0);
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'space') return;
      load();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [load]);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      await request({ method: 'PATCH', url: `/admin/fleet/trucks/${id}/${action}` });
      setTrucks((prev) => prev.filter((x) => x.id !== id));
      setTotal((n) => Math.max(0, n - 1));
      notifySuccess(
        action === 'approve'
          ? t('pages.admin.fleetApproved')
          : action === 'reject'
            ? t('pages.admin.fleetRejected')
            : t('pages.admin.fleetSuspended')
      );
    } catch {
      /* useApi toast */
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container py-3 tp-dashboard tp-dashboard--admin">
      <h5 className="mb-1">{t('pages.admin.fleetQueueTitle')}</h5>
      <p className="small text-muted mb-3">{t('pages.admin.fleetQueueHint')}</p>
      {loading && trucks.length === 0 ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : trucks.length === 0 ? (
        <div className="text-muted text-center py-5 px-3 tp-empty-state rounded-3 border border-dashed">
          {t('pages.admin.fleetQueueEmpty')}
        </div>
      ) : (
        <>
          <p className="small text-muted mb-2">
            {t('pages.admin.fleetPendingCount', { count: total })}
          </p>
          <div className="row g-3">
            {trucks.map((truck) => (
              <div key={truck.id} className="col-12 col-lg-6">
                <Card className="p-3 h-100">
                  <div className="d-flex justify-content-between gap-2 mb-2">
                    <div>
                      <div className="fw-semibold">{truck.carrierName}</div>
                      <div className="small text-muted text-break">{truck.carrierEmail}</div>
                    </div>
                    <span className={`badge ${fleetStatusBadgeClass(truck.statusLabel || truck.status)}`}>
                      {truck.statusLabel || truck.status}
                    </span>
                  </div>
                  <div className="small mb-2">
                    <div>
                      {truck.truckType} · {truck.capacity}t · {truck.licensePlate}
                    </div>
                    <div className="text-muted">{truck.engineNumber}</div>
                    {!truck.documentsComplete ? (
                      <div className="text-warning mt-1">{t('pages.admin.fleetDocsIncomplete')}</div>
                    ) : null}
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <SafeImage
                        src={truck.truckCardFrontImage}
                        alt=""
                        className="rounded border w-100 tp-img-contain-full"
                        style={{ maxHeight: 120 }}
                      />
                    </div>
                    <div className="col-6">
                      <SafeImage
                        src={truck.truckCardBackImage}
                        alt=""
                        className="rounded border w-100 tp-img-contain-full"
                        style={{ maxHeight: 120 }}
                      />
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <Button
                      variant="success"
                      className="btn-sm"
                      disabled={busyId === truck.id || !truck.documentsComplete}
                      onClick={() => act(truck.id, 'approve')}
                    >
                      {t('pages.admin.fleetApprove')}
                    </Button>
                    <Button
                      variant="outline-danger"
                      className="btn-sm"
                      disabled={busyId === truck.id}
                      onClick={() => act(truck.id, 'reject')}
                    >
                      {t('pages.admin.fleetReject')}
                    </Button>
                    <Button
                      variant="outline-warning"
                      className="btn-sm"
                      disabled={busyId === truck.id}
                      onClick={() => act(truck.id, 'suspend')}
                    >
                      {t('pages.admin.fleetSuspend')}
                    </Button>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminFleetQueue;
