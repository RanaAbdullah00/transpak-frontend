import React, { useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { notifySuccess, notifyError } from '../../components/ui/ToastProvider.jsx';

const VerificationQueue = () => {
  const { request, loading } = useApi();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await request({ url: '/admin/users' });
        setUsers(Array.isArray(data) ? data : []);
      } catch (e) {
        notifyError(e?.response?.data?.message || 'Failed to load verification queue');
        setUsers([]);
      }
    })();
  }, [request]);

  const setVerified = async (id, verified) => {
    try {
      await request({ method: 'PATCH', url: `/admin/users/${id}/verify`, data: { verified } });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, verified } : u)));
      notifySuccess(verified ? 'User verified' : 'Verification removed');
    } catch {
      notifyError('Failed to update verification');
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Verification queue</h5>
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : (
        users.map((u) => (
          <Card key={u.id}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="fw-semibold">{u.name}</div>
                <div className="small text-muted">CNIC: {u.cnic}</div>
              </div>
              <div className="d-flex gap-2">
                <Button
                  variant={u.verified ? 'success' : 'primary'}
                  className="btn-sm rounded-lg"
                  onClick={() => setVerified(u.id, true)}
                >
                  Approve
                </Button>
                <Button
                  variant="outline-secondary"
                  className="btn-sm rounded-lg"
                  onClick={() => setVerified(u.id, false)}
                >
                  Reject
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default VerificationQueue;

