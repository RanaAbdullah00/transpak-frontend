import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { ensureArray } from '../../utils/unwrapApi.js';

const ShipmentControl = () => {
  const { request, loading } = useApi();
  const { t } = useLanguage();
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await request({ url: '/admin/shipments', expectList: true });
        setShipments(ensureArray(data));
      } catch {
        setShipments([]);
      }
    })();
  }, [request, t]);

  return (
    <section className="container py-3 tp-dashboard tp-dashboard--admin">
      <h5 className="mb-2">{t('nav.shipments')}</h5>
      <p className="small text-muted mb-3">{t('pages.admin.shipmentsReadOnlyLead')}</p>
      {loading ? (
        <p className="d-flex justify-content-center py-5">
          <Loader />
        </p>
      ) : !shipments.length ? (
        <Card className="p-4 text-center text-muted small">{t('pages.admin.noShipments')}</Card>
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
                  <Link
                    to={`/shipments/tracking/${encodeURIComponent(s.code || s.loadId)}`}
                    className="small"
                  >
                    {t('pages.admin.trackShipment')}
                  </Link>
                ) : null}
              </div>
            </div>
          </Card>
        ))
      )}
    </section>
  );
};

export default ShipmentControl;
