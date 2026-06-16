import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import Button from '../../components/ui/Button.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { ensureArray } from '../../utils/unwrapApi.js';
import { formatUserError } from '../../utils/userErrors.js';
import { notifySuccess } from '../../components/ui/ToastProvider.jsx';
import api from '../../services/api.js';

const CATEGORIES = ['all', 'fleet', 'bid', 'shipment', 'capacity', 'system', 'security'];

function matchesCategory(row, cat) {
  if (!cat || cat === 'all') return true;
  const hay = `${row.title || ''} ${row.type || ''} ${row.message || ''}`.toLowerCase();
  if (cat === 'fleet') return hay.includes('fleet') || hay.includes('truck');
  if (cat === 'bid') return hay.includes('bid');
  if (cat === 'shipment') return hay.includes('shipment') || hay.includes('tracking');
  if (cat === 'capacity') return hay.includes('space') || hay.includes('capacity');
  if (cat === 'security') return hay.includes('security') || hay.includes('otp');
  if (cat === 'system') return hay.includes('system') || hay.includes('alert');
  return true;
}

const AdminNotifications = () => {
  const { request } = useApi();
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [mine, platform] = await Promise.all([
        request({ url: '/notifications', params: { limit: 200 } }).catch(() => []),
        request({ url: '/admin/notifications', expectList: true }).catch(() => [])
      ]);
      const merged = [...ensureArray(mine), ...ensureArray(platform)];
      const byId = new Map();
      merged.forEach((n) => {
        const id = String(n.id || `${n.message}-${n.createdAt}`);
        if (!byId.has(id)) byId.set(id, { ...n, id });
      });
      setRows([...byId.values()].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
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
    const onRefresh = () => refresh();
    window.addEventListener('tp:realtime-refresh', onRefresh);
    window.addEventListener('tp:notifications-refresh', onRefresh);
    return () => {
      window.removeEventListener('tp:realtime-refresh', onRefresh);
      window.removeEventListener('tp:notifications-refresh', onRefresh);
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((n) => {
      if (!matchesCategory(n, category)) return false;
      if (!q) return true;
      return `${n.message || ''} ${n.title || ''} ${n.receiverName || ''}`.toLowerCase().includes(q);
    });
  }, [rows, category, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const markRead = async (id) => {
    try {
      await api.patch(`/admin/notifications/${id}/read`);
      setRows((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (e) {
      setError(formatUserError(e, t));
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/admin/notifications/read-all');
      setRows((prev) => prev.map((n) => ({ ...n, read: true })));
      notifySuccess(t('notifications.markAllRead'));
    } catch (e) {
      setError(formatUserError(e, t));
    }
  };

  const unread = rows.filter((n) => !n.read).length;

  return (
    <div className="container py-3 tp-dashboard tp-dashboard--admin">
      <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
        <h5 className="mb-0">
          {t('pages.admin.notificationsTitle')}
          {unread > 0 ? <span className="badge bg-danger ms-2">{unread}</span> : null}
        </h5>
        <Link to="/admin/dashboard" className="btn btn-sm btn-outline-secondary">
          {t('common.back')}
        </Link>
      </div>
      <p className="small text-muted mb-3">{t('pages.admin.notificationsLead')}</p>

      <Card className="p-3 mb-3 border-0 shadow-sm">
        <div className="row g-2 align-items-center">
          <div className="col-md-4">
            <select className="form-select form-select-sm" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`pages.admin.notifCat_${c}`)}</option>
              ))}
            </select>
          </div>
          <div className="col-md-5">
            <input
              className="form-control form-control-sm"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="col-md-3 text-md-end">
            <Button variant="outline-primary" size="sm" onClick={markAllRead} disabled={!unread}>
              {t('notifications.markAllRead')}
            </Button>
          </div>
        </div>
      </Card>

      {error ? <div className="alert alert-warning">{error}</div> : null}

      {loading ? (
        <SkeletonTable cols={5} rows={8} />
      ) : (
        <>
          <Card className="p-0 overflow-hidden border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead>
                  <tr>
                    <th className="ps-3">{t('pages.admin.notifReceiver')}</th>
                    <th>{t('pages.admin.notifMessage')}</th>
                    <th>{t('pages.admin.tableStatus')}</th>
                    <th className="pe-3">{t('pages.admin.tableCreated')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((n) => (
                    <tr key={n.id} className={!n.read ? 'table-active' : ''}>
                      <td className="ps-3 small">{n.receiverName || n.receiverId || '—'}</td>
                      <td className="small">{n.message || n.title}</td>
                      <td className="small">{n.read ? t('pages.admin.read') : t('pages.admin.unread')}</td>
                      <td className="pe-3 small text-muted">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="pe-3">
                        {!n.read ? (
                          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => markRead(n.id)}>
                            {t('notifications.markRead')}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!pageRows.length && !error ? (
              <EmptyState icon={FaBell} title={t('empty.notificationsTitle')} body={t('empty.notificationsBody')} className="border-0" />
            ) : null}
          </Card>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-3" />
        </>
      )}
    </div>
  );
};

export default AdminNotifications;
