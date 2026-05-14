import React, { useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';

const Disputes = () => {
  const { request, loading } = useApi();
  const [disputes, setDisputes] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await request({ url: '/admin/disputes' });
        setDisputes(Array.isArray(data) ? data : []);
      } catch (e) {
        notifyError(e?.response?.data?.message || 'Failed to load disputes');
        setDisputes([]);
      }
    })();
  }, [request]);

  const resolve = async (id) => {
    try {
      await request({ method: 'PATCH', url: `/admin/disputes/${id}/resolve` });
      setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'resolved' } : d)));
      notifySuccess('Dispute resolved');
    } catch {
      notifyError('Failed to resolve dispute');
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Disputes</h5>
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : (
        disputes.map((d) => (
          <Card key={d.id}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="fw-semibold">{d.loadCode}</div>
                <div className="small text-muted">{d.reason}</div>
                <div className="small mt-1">
                  Status: <span className="fw-semibold">{d.status}</span>
                </div>
              </div>
              <Button
                variant="primary"
                className="btn-sm rounded-lg"
                disabled={d.status !== 'open'}
                onClick={() => resolve(d.id)}
              >
                Resolve
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default Disputes;

