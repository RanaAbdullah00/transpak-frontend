import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifySuccess } from '../../components/ui/ToastProvider.jsx';

const ShipmentControl = () => {
  const { request, loading } = useApi();
  const { t } = useLanguage();
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await request({ url: '/admin/shipments' });
        setShipments(Array.isArray(data) ? data : []);
      } catch (e) {
        setShipments([]);
      }
    })();
  }, [request, t]);

  const updateStatus = async (id, status, force = false) => {
    try {
      const data = await request({
        method: 'PATCH',
        url: `/admin/shipments/${id}/status`,
        data: { status, force }
      });
      const nextStatus = data?.status || status;
      setShipments((prev) => prev.map((s) => (s.id === id ? { ...s, status: nextStatus } : s)));
      notifySuccess(t('pages.admin.shipmentUpdated'));
    } catch {
      /* useApi already surfaced the error */
    }
  };

  return (
    <section className="container py-3">
      <h5 className="mb-3">{t('nav.shipments')}</h5>
      {loading ? (
        <p className="d-flex justify-content-center py-5">
          <Loader />
        </p>
      ) : (
        shipments.map((s) => (
          <Card key={s.id} className="mb-2">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
              <div>
                <p className="fw-semibold mb-1">{s.code}</p>
                <p className="small text-muted mb-1">
                  {s.origin} → {s.destination}
                </p>
                <p className="small mb-1">
                  {t('pages.admin.tableStatus')}: <span className="fw-semibold">{s.status}</span>
                </p>
                {s.code || s.loadId ? (
                  <Link to={`/shipments/tracking/${encodeURIComponent(s.code || s.loadId)}`} className="small">
                    {t('pages.admin.trackShipment')}
                  </Link>
                ) : null}
              </div>
              <div className="d-flex gap-2 flex-wrap justify-content-end">
                {['booked', 'pickedup', 'intransit', 'delivered'].map((st) => (
                  <Button
                    key={st}
                    variant="outline-primary"
                    className="btn-sm rounded-lg"
                    onClick={() => updateStatus(s.id, st, false)}
                  >
                    {st}
                  </Button>
                ))}
                <Button
                  variant="outline-danger"
                  className="btn-sm rounded-lg"
                  onClick={() => updateStatus(s.id, 'delivered', true)}
                >
                  {t('pages.admin.forceDelivered')}
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </section>
  );
};

export default ShipmentControl;
