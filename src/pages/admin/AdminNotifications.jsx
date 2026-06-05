import React, { useCallback, useEffect, useState } from 'react';
import { FaBell } from 'react-icons/fa';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { ensureArray } from '../../utils/unwrapApi.js';
import { formatUserError } from '../../utils/userErrors.js';
import TranslatedText from '../../components/ui/TranslatedText.jsx';

const AdminNotifications = () => {
  const { request } = useApi();
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await request({ url: '/admin/notifications', expectList: true });
      setRows(ensureArray(data));
    } catch (e) {
      setError(formatUserError(e, t, { fallback: t('pages.admin.notificationsLoadFailed') }));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [request, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'loads' && scope !== 'bids' && scope !== 'shipments' && scope !== 'space') {
        return;
      }
      refresh();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [refresh]);

  return (
    <div className="container py-3 tp-dashboard tp-dashboard--admin">
      <h5 className="mb-2">{t('pages.admin.notificationsTitle')}</h5>
      <p className="small text-muted mb-3">{t('pages.admin.notificationsLead')}</p>
      {error && (
        <div className="alert alert-warning rounded-3">
          <TranslatedText text={error} as="span" />
        </div>
      )}
      {loading ? (
        <SkeletonTable cols={5} rows={8} />
      ) : (
        <Card className="p-0 overflow-hidden border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0">
              <thead>
                <tr>
                  <th className="ps-3">{t('pages.admin.notifReceiver')}</th>
                  <th>{t('pages.admin.notifMessage')}</th>
                  <th>{t('pages.admin.tableStatus')}</th>
                  <th className="pe-3">{t('pages.admin.tableCreated')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => (
                  <tr key={n.id}>
                    <td className="ps-3 small">{n.receiverName || n.receiverId}</td>
                    <td className="small">{n.message || n.title}</td>
                    <td className="small">{n.read ? t('pages.admin.read') : t('pages.admin.unread')}</td>
                    <td className="pe-3 small text-muted">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && !error && (
            <EmptyState
              icon={FaBell}
              title={t('empty.notificationsTitle')}
              body={t('empty.notificationsBody')}
              className="border-0"
            />
          )}
        </Card>
      )}
    </div>
  );
};

export default AdminNotifications;
