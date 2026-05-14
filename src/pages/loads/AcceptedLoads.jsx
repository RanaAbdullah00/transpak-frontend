import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Loader from '../../components/ui/Loader.jsx';
import Button from '../../components/ui/Button.jsx';
import { useApi } from '../../hooks/useApi.js';
import { normalizeLoads } from '../../adapters/normalize.js';

const AcceptedLoads = () => {
  const { request, loading } = useApi();
  const [loads, setLoads] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      // For MVP: reuse /loads marketplace and filter client-side by assignedCarrierId if present in response
      // (Backend currently returns open loads only on /loads; accepted loads should be tracked via /loads/:id after accept.)
      const mineBids = await request({ method: 'GET', url: '/bids/mine' });
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
      setLoads(normalizeLoads(details.filter(Boolean)));
    };
    run();
  }, [request]);

  return (
    <div className="container py-3">
      <h5 className="mb-3">Accepted loads</h5>
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : loads.length === 0 ? (
        <div className="text-center text-muted py-5">No accepted loads yet.</div>
      ) : (
        loads.map((l) => (
          <Card key={l.id} className="p-3">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="fw-semibold">{l.cargo}</div>
                <div className="small text-muted">{l.code} · {l.origin} → {l.destination}</div>
                <div className="small text-muted mt-1">Pickup: {l.pickupDate || '—'}</div>
              </div>
              <Badge variant={l.status === 'assigned' ? 'warning' : 'secondary'}>{l.status}</Badge>
            </div>
            <div className="d-flex justify-content-end mt-2">
              <Button variant="primary" size="sm" onClick={() => navigate(`/shipments/tracking/${l.id}`)}>
                Track
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default AcceptedLoads;

