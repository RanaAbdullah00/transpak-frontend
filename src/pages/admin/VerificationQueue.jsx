import React, { useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { ensureArray } from '../../utils/unwrapApi.js';
import { notifySuccess } from '../../components/ui/ToastProvider.jsx';

const VerificationQueue = () => {
  const { request, loading } = useApi();
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await request({ url: '/admin/users?verified=false', expectList: true });
        setUsers(ensureArray(data));
      } catch {
        setUsers([]);
      }
    })();
  }, [request]);

  const setVerified = async (id, verified) => {
    try {
      await request({ method: 'PATCH', url: `/admin/users/${id}/verify`, data: { verified } });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, verified } : u)));
      notifySuccess(verified ? t('pages.admin.verificationApproved') : t('pages.admin.verificationRemoved'));
    } catch {
      /* useApi → notifyApiError */
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('pages.admin.verificationTitle')}</h5>
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : users.length === 0 ? (
        <div className="text-muted text-center py-5 px-3 tp-empty-state rounded-3 border border-dashed">
          {t('pages.admin.emptyVerification')}
        </div>
      ) : (
        users.map((u) => (
          <Card key={u.id}>
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
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
                  {t('pages.admin.verificationApprove')}
                </Button>
                <Button
                  variant="outline-secondary"
                  className="btn-sm rounded-lg"
                  onClick={() => setVerified(u.id, false)}
                >
                  {t('pages.admin.verificationReject')}
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
