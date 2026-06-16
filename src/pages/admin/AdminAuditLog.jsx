import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import AdminActivityCard from '../../components/admin/AdminActivityCard.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { formatUserError } from '../../utils/userErrors.js';

const AdminAuditLog = () => {
  const { request } = useApi();
  const { t, locale } = useLanguage();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', entity: '', q: '' });

  const formatWhen = (ts) => (ts ? new Date(ts).toLocaleString(locale) : '—');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request({
        url: '/admin/audit-events',
        params: { page, limit: 25, ...filters }
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotalPages(data?.totalPages || 1);
    } catch (err) {
      setItems([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [request, page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="container py-3 tp-dashboard tp-dashboard--admin">
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <h5 className="mb-0">{t('pages.admin.auditLogTitle')}</h5>
        <Link to="/admin/dashboard" className="btn btn-sm btn-outline-secondary">
          {t('common.back')}
        </Link>
      </div>

      <Card className="p-3 mb-3 border-0 shadow-sm">
        <div className="row g-2">
          <div className="col-md-4">
            <input
              className="form-control form-control-sm"
              placeholder={t('pages.admin.auditFilterAction')}
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            />
          </div>
          <div className="col-md-4">
            <input
              className="form-control form-control-sm"
              placeholder={t('pages.admin.auditFilterEntity')}
              value={filters.entity}
              onChange={(e) => setFilters((f) => ({ ...f, entity: e.target.value }))}
            />
          </div>
          <div className="col-md-4 d-flex gap-2">
            <input
              className="form-control form-control-sm"
              placeholder={t('common.search')}
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setPage(1);
                load();
              }}
            >
              {t('common.search')}
            </button>
          </div>
        </div>
      </Card>

      {loading ? (
        <SkeletonTable cols={4} rows={10} />
      ) : (
        <>
          <ul className="list-unstyled tp-admin-activity-list mb-3">
            {items.map((ev) => (
              <AdminActivityCard
                key={ev.id}
                label={ev.action}
                detail={`${ev.targetEntity}${ev.targetId ? ` · ${String(ev.targetId).slice(0, 8)}` : ''}`}
                meta={ev.actorName}
                timestamp={formatWhen(ev.createdAt)}
                variant="system"
                icon="📋"
              />
            ))}
          </ul>
          {!items.length ? <p className="text-muted small">{t('pages.admin.auditLogEmpty')}</p> : null}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default AdminAuditLog;
