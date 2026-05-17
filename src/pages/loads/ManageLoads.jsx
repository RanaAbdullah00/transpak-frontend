import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { SkeletonCard } from '../../components/ui/Skeleton.jsx';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';

// Shipper screen to manage their posted loads (open/assigned/completed).
const ManageLoads = ({ embedded = false }) => {
  const { request, loading } = useApi();
  const { t } = useLanguage();
  const [loads, setLoads] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await request({ url: '/loads/mine' });
      setLoads(Array.isArray(rows) ? rows : []);
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.loads.failedLoadMine') }));
      setLoads([]);
    }
  }, [request, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const normalizedLoads = useMemo(
    () =>
      loads.map((l) => ({
        id: l.id || l._id,
        code: l.code || '—',
        cargo: l.cargo || l.title || 'Load',
        origin: l.origin || '—',
        destination: l.destination || '—',
        status: l.status || 'open',
        bids: Number(l.bidCount ?? l.bids ?? 0)
      })),
    [loads]
  );

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.id) return;
    try {
      await request({ method: 'DELETE', url: `/loads/${deleteTarget.id}` });
      notifySuccess(t('pages.loads.loadDeleted'));
      await refresh();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.loads.failedDeleteLoad') }));
    }
  };

  return (
    <div className={embedded ? '' : 'container py-3'}>
      {!embedded ? (
        <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
          <h5 className="mb-0">{t('pages.loads.manageTitle')}</h5>
          <Link to="/loads/post">
            <Button variant="primary" className="btn-sm px-3 rounded-lg">
              + {t('pages.loads.postLoadCta')}
            </Button>
          </Link>
        </div>
      ) : null}

      {loading ? (
        <div className="d-flex flex-column gap-3">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={3} />
          <SkeletonCard rows={3} />
        </div>
      ) : normalizedLoads.length === 0 ? (
        <div className="text-center py-5 px-3 rounded-xl tp-surface-muted">
          <p className="text-muted mb-2 fw-medium">{t('pages.loads.noLoadsTitle')}</p>
          <p className="small text-muted mb-3">{t('pages.loads.noLoadsBody')}</p>
          <Link to="/loads/post">
            <Button variant="primary" className="rounded-lg">
              {t('pages.loads.postLoadCta')}
            </Button>
          </Link>
        </div>
      ) : (
        normalizedLoads.map((l) => {
          const isOpen = l.status === 'open';
          return (
            <Card key={l.id}>
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <h6 className="mb-1">{l.cargo}</h6>
                  <div className="small text-muted">
                    {l.code} · {l.origin} → {l.destination}
                  </div>
                </div>
                <Badge
                  variant={l.status === 'open' ? 'success' : l.status === 'assigned' ? 'warning' : 'secondary'}
                >
                  {l.status}
                </Badge>
              </div>
              <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                <small className="text-muted">{t('pages.loads.bidsCount', { count: l.bids })}</small>
                <div className="d-flex gap-2 flex-wrap justify-content-end">
                  <Link to={`/loads/${l.id}`}>
                    <Button variant="outline-primary" className="btn-sm rounded-lg">
                      {t('pages.loads.view')}
                    </Button>
                  </Link>
                  {isOpen ? (
                    <Link to={`/loads/${l.id}/edit`}>
                      <Button variant="outline-secondary" className="btn-sm rounded-lg">
                        {t('pages.loads.edit')}
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline-secondary" className="btn-sm rounded-lg" disabled title={t('pages.loads.onlyOpenEdit')}>
                      {t('pages.loads.edit')}
                    </Button>
                  )}
                  {isOpen ? (
                    <Button
                      variant="outline-danger"
                      className="btn-sm rounded-lg"
                      onClick={() => setDeleteTarget(l)}
                    >
                      {t('pages.loads.delete')}
                    </Button>
                  ) : (
                    <Button variant="outline-danger" className="btn-sm rounded-lg" disabled title={t('pages.loads.onlyOpenDelete')}>
                      {t('pages.loads.delete')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      )}

      <ConfirmActionModal
        show={Boolean(deleteTarget)}
        title={t('pages.loads.deleteLoadTitle')}
        message={t('pages.loads.deleteLoadMessage')}
        confirmText={t('pages.loads.delete')}
        confirmVariant="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default ManageLoads;
