import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import AdminActivityCard from '../../components/admin/AdminActivityCard.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';

const TYPE_OPTIONS = ['all', 'load', 'bid', 'shipment', 'audit'];

const AdminActivityCenter = () => {
  const { request } = useApi();
  const { t, locale } = useLanguage();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [items, setItems] = useState([]);
  const [type, setType] = useState('all');
  const [loading, setLoading] = useState(true);

  const formatWhen = (ts) => (ts ? new Date(ts).toLocaleString(locale) : '—');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request({
        url: '/admin/activity-feed',
        params: { page, limit: 25, type }
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotalPages(data?.totalPages || 1);
    } catch {
      setItems([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [request, page, type]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="container py-3 tp-dashboard tp-dashboard--admin">
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <h5 className="mb-0">{t('pages.admin.recentActivity')}</h5>
        <Link to="/admin/dashboard" className="btn btn-sm btn-outline-secondary">
          {t('common.back')}
        </Link>
      </div>

      <Card className="p-3 mb-3 border-0 shadow-sm">
        <select
          className="form-select form-select-sm"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {t(`pages.admin.activityType_${opt}`)}
            </option>
          ))}
        </select>
      </Card>

      {loading ? (
        <SkeletonTable cols={4} rows={10} />
      ) : (
        <>
          <ul className="list-unstyled tp-admin-activity-list mb-3">
            {items.map((row) => (
              <AdminActivityCard
                key={`${row.type}-${row.id}-${row.ts}`}
                label={row.action}
                detail={`${row.ref || row.type}${row.detail ? ` · ${row.detail}` : ''}`}
                meta={row.actor}
                timestamp={formatWhen(row.ts)}
                variant={row.type === 'bid' ? 'warning' : 'info'}
                icon={row.type === 'shipment' ? '🚚' : row.type === 'bid' ? '💰' : '📦'}
              />
            ))}
          </ul>
          {!items.length ? <p className="text-muted small">{t('pages.admin.noRecentActivity')}</p> : null}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default AdminActivityCenter;
