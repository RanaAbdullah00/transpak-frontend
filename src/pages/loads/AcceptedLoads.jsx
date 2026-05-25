import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Loader from '../../components/ui/Loader.jsx';
import Button from '../../components/ui/Button.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { normalizeLoads } from '../../adapters/normalize.js';

const AcceptedLoads = () => {
  const { request, loading } = useApi();
  const { t } = useLanguage();
  const [loads, setLoads] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const mineBids = await request({ method: 'GET', url: '/bids/mine' });
        if (!alive) return;
        const bidList = Array.isArray(mineBids) ? mineBids : [];
        const accepted = bidList.filter((b) => String(b.status) === 'accepted');
        const loadIds = accepted.map((b) => b.loadId).filter(Boolean);
        const details = await Promise.all(
          loadIds.map(async (id) => {
            try {
              return await request({ method: 'GET', url: `/loads/${id}` });
            } catch {
              return null;
            }
          })
        );
        if (alive) setLoads(normalizeLoads(details.filter(Boolean)));
      } catch {
        if (alive) setLoads([]);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [request]);

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('pages.loads.acceptedLoadsTitle')}</h5>
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : loads.length === 0 ? (
        <div className="text-center text-muted py-5 px-3 tp-empty-state rounded-3 border border-dashed">
          {t('pages.loads.emptyAcceptedLoads')}
        </div>
      ) : (
        loads.map((l) => (
          <Card key={l.id} className="p-3">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div className="fw-semibold">{l.cargo}</div>
                <div className="small text-muted">
                  {l.code} · {l.origin} → {l.destination}
                </div>
                <div className="small text-muted mt-1">
                  {t('pages.loads.pickupLabel')}: {l.pickupDate || t('common.emDash')}
                </div>
              </div>
              <Badge variant={l.status === 'assigned' ? 'warning' : 'secondary'}>{l.status}</Badge>
            </div>
            <div className="d-flex justify-content-end mt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/shipments/tracking/${encodeURIComponent(l.code || l.id)}`)}
              >
                {t('pages.loads.trackShipment')}
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default AcceptedLoads;
