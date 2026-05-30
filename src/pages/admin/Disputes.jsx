import React, { useEffect, useState } from 'react';
import { FaBalanceScale } from 'react-icons/fa';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { SkeletonCard } from '../../components/ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { ensureArray } from '../../utils/unwrapApi.js';
import { notifySuccess } from '../../components/ui/ToastProvider.jsx';

const Disputes = () => {
  const { request, loading } = useApi();
  const { t } = useLanguage();
  const [disputes, setDisputes] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await request({ url: '/admin/disputes', expectList: true });
        setDisputes(ensureArray(data));
      } catch {
        setDisputes([]);
      }
    })();
  }, [request]);

  const resolve = async (id) => {
    try {
      await request({ method: 'PATCH', url: `/admin/disputes/${id}/resolve` });
      setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'resolved' } : d)));
      notifySuccess(t('pages.admin.disputeResolved'));
    } catch {
      /* useApi → notifyApiError */
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('pages.admin.disputesTitle')}</h5>
      {loading ? (
        <SkeletonCard rows={3} />
      ) : disputes.length === 0 ? (
        <EmptyState
          icon={FaBalanceScale}
          title={t('empty.disputesTitle')}
          body={t('empty.disputesBody')}
        />
      ) : (
        disputes.map((d) => (
          <Card key={d.id}>
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div className="fw-semibold">{d.loadCode}</div>
                <div className="small text-muted">{d.reason}</div>
                <div className="small mt-1">
                  {t('pages.admin.disputeStatus')}: <span className="fw-semibold">{d.status}</span>
                </div>
              </div>
              <Button
                variant="primary"
                className="btn-sm rounded-lg"
                disabled={d.status !== 'open'}
                onClick={() => resolve(d.id)}
              >
                {t('pages.admin.disputeResolve')}
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default Disputes;
