import React, { useCallback, useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { ensureArray } from '../../utils/unwrapApi.js';
import { notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { translateShipmentOrLoadStatus } from '../../utils/i18nLabels.js';

const AdminLoads = () => {
  const { request } = useApi();
  const { t } = useLanguage();
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await request({ url: '/admin/loads', expectList: true });
      setLoads(ensureArray(data));
    } catch {
      setLoads([]);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const del = async (id) => {
    try {
      await request({ method: 'DELETE', url: `/admin/loads/${id}` });
      setLoads((prev) => prev.filter((l) => l.id !== id));
      notifySuccess(t('pages.admin.loadDeleted'));
    } catch {
      /* useApi → notifyApiError */
    }
  };

  const statusBadgeClass = (status) => {
    const s = String(status || '');
    if (s === 'open') return 'bg-success';
    if (s === 'assigned') return 'bg-warning text-dark';
    if (s === 'in_transit') return 'bg-info text-dark';
    if (s === 'delivered') return 'bg-primary';
    if (s === 'cancelled') return 'bg-secondary';
    return 'bg-secondary';
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('pages.admin.loadsTitle')}</h5>
      {loading ? (
        <SkeletonTable cols={6} rows={8} />
      ) : loads.length === 0 ? (
        <div className="text-muted text-center py-5">{t('pages.admin.emptyLoads')}</div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover table-sm mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th className="ps-3 py-3">{t('pages.admin.tableCode')}</th>
                  <th className="py-3">{t('pages.admin.tableCargo')}</th>
                  <th className="py-3 d-none d-lg-table-cell">{t('pages.admin.tableRoute')}</th>
                  <th className="py-3">{t('pages.admin.tablePickup')}</th>
                  <th className="py-3">{t('pages.admin.tableStatus')}</th>
                  <th className="pe-3 py-3 text-end">{t('pages.admin.tableAction')}</th>
                </tr>
              </thead>
              <tbody>
                {loads.map((l) => (
                  <tr key={l.id}>
                    <td className="ps-3 py-3 fw-semibold">{l.code}</td>
                    <td className="py-3">
                      <small>{l.cargo || t('common.emDash')}</small>
                    </td>
                    <td className="py-3 d-none d-lg-table-cell">
                      <small className="text-muted">
                        {l.origin || t('common.emDash')} → {l.destination || t('common.emDash')}
                      </small>
                    </td>
                    <td className="py-3">
                      <small>{l.pickupDate || t('common.emDash')}</small>
                    </td>
                    <td className="py-3">
                      <span className={`badge rounded-pill ${statusBadgeClass(l.status)}`}>
                        {translateShipmentOrLoadStatus(t, l.status)}
                      </span>
                    </td>
                    <td className="pe-3 py-3 text-end">
                      <Button variant="outline-danger" onClick={() => del(l.id)} className="btn-sm rounded-lg">
                        {t('pages.loads.delete')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminLoads;
