import React, { useEffect, useState } from 'react';
import { FaGavel } from 'react-icons/fa';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { ensureArray } from '../../utils/unwrapApi.js';
import { formatUserError } from '../../utils/userErrors.js';
import TranslatedText from '../../components/ui/TranslatedText.jsx';

const AdminBids = () => {
  const { request } = useApi();
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await request({ url: '/admin/bids', expectList: true });
        if (!cancelled) setRows(ensureArray(data));
      } catch (e) {
        if (!cancelled) {
          setError(formatUserError(e, t, { fallback: t('pages.admin.bidsLoadFailed') }));
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request, t]);

  useEffect(() => {
    const refresh = async () => {
      try {
        setError(null);
        const data = await request({ url: '/admin/bids', expectList: true });
        setRows(ensureArray(data));
      } catch (e) {
        setError(formatUserError(e, t, { fallback: t('pages.admin.bidsLoadFailed') }));
        setRows([]);
      }
    };
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'loads' && scope !== 'bids' && scope !== 'shipments') return;
      refresh();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [request, t]);

  return (
    <div className="container py-3 tp-dashboard tp-dashboard--admin">
      <h5 className="mb-3">{t('pages.admin.bidsTitle')}</h5>
      {error && (
        <div className="alert alert-warning rounded-3">
          <TranslatedText text={error} as="span" />
        </div>
      )}
      {loading ? (
        <SkeletonTable cols={6} rows={8} />
      ) : (
        <Card className="p-0 overflow-hidden border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead>
                <tr>
                  <th className="ps-3">{t('pages.admin.tableCode')}</th>
                  <th>{t('pages.admin.tableRoute')}</th>
                  <th>{t('auth.carrier')}</th>
                  <th>PKR</th>
                  <th>{t('pages.admin.tableStatus')}</th>
                  <th className="pe-3">{t('pages.admin.tableCreated')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td className="ps-3 fw-semibold">{b.loadCode || b.loadId}</td>
                    <td className="small">
                      {b.origin} → {b.destination}
                    </td>
                    <td className="small">{b.carrierName}</td>
                    <td>{Number(b.amount || 0).toLocaleString()}</td>
                    <td className="small">{b.status}</td>
                    <td className="pe-3 small text-muted">
                      {b.createdAt ? new Date(b.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && !error && (
            <EmptyState
              icon={FaGavel}
              title={t('pages.admin.emptyBids')}
              body={t('empty.bidsBody')}
              className="border-0"
            />
          )}
        </Card>
      )}
    </div>
  );
};

export default AdminBids;
