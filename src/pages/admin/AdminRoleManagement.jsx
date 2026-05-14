import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';

const ROLE_OPTIONS = ['shipper', 'carrier', 'admin'];

const AdminRoleManagement = () => {
  const { request } = useApi();
  const { user: authUser } = useAuth();
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [pending, setPending] = useState(null);

  const authId = authUser?.id || authUser?._id;

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setListError(null);
      const data = await request({ url: '/admin/users' });
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      const nextDrafts = {};
      for (const u of list) {
        const id = u.id;
        const initial = ROLE_OPTIONS.includes(u.activeRole) ? u.activeRole : u.roles?.[0] || 'shipper';
        nextDrafts[id] = initial;
      }
      setDrafts(nextDrafts);
    } catch (e) {
      setListError(formatUserError(e, t, { fallback: t('pages.admin.roleMgmt.loadFailed') }));
      setRows([]);
      setDrafts({});
    } finally {
      setLoading(false);
    }
  }, [request, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isDirty = useCallback(
    (u) => {
      const selected = drafts[u.id];
      if (!selected) return false;
      if (u.activeRole !== selected) return true;
      const r = Array.isArray(u.roles) ? [...u.roles].sort().join(',') : '';
      return r !== [selected].sort().join(',');
    },
    [drafts]
  );

  const applyPatch = async () => {
    if (!pending) return;
    const { id, role } = pending;
    try {
      const res = await request({
        method: 'PATCH',
        url: `/admin/user/${id}/role`,
        data: { roles: [role], activeRole: role }
      });
      const updated = res?.user;
      if (updated) {
        setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
        setDrafts((d) => ({ ...d, [updated.id]: updated.activeRole || role }));
      } else {
        await refresh();
      }
      notifySuccess(t('pages.admin.roleMgmt.updateSuccess'));
    } catch (e) {
      notifyError(formatUserError(e, t, { fallback: t('pages.admin.roleMgmt.updateFailed') }));
    }
  };

  const onSelectChange = (userId, value) => {
    setDrafts((d) => ({ ...d, [userId]: value }));
  };

  const roleLabels = useMemo(
    () => ({
      shipper: t('auth.shipper'),
      carrier: t('auth.carrier'),
      admin: t('common.admin')
    }),
    [t]
  );

  return (
    <div className="container py-3">
      <h5 className="mb-2">{t('pages.admin.roleMgmt.title')}</h5>
      <p className="small text-muted mb-3">{t('pages.admin.roleMgmt.subtitle')}</p>

      {listError && (
        <div className="alert alert-danger rounded-3 border-0 shadow-sm" role="alert">
          {listError}
          <button type="button" className="btn btn-sm btn-outline-danger ms-2 rounded-lg" onClick={() => refresh()}>
            {t('pages.admin.tryAgain')}
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonTable cols={5} rows={8} />
      ) : (
        <Card className="p-0 overflow-hidden border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover table-sm mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th className="ps-3 py-3">{t('auth.fullName')}</th>
                  <th className="py-3">{t('auth.email')}</th>
                  <th className="py-3 d-none d-md-table-cell">{t('pages.admin.roleMgmt.columnCurrent')}</th>
                  <th className="py-3">{t('pages.admin.roleMgmt.columnAssign')}</th>
                  <th className="pe-3 py-3 text-end">{t('pages.admin.roleMgmt.columnAction')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const isSelf = String(u.id) === String(authId);
                  const selected = drafts[u.id] || u.activeRole || 'shipper';
                  const dirty = !isSelf && isDirty(u);
                  return (
                    <tr key={u.id}>
                      <td className="ps-3 py-3 fw-semibold">{u.name}</td>
                      <td className="py-3">
                        <small>{u.email}</small>
                      </td>
                      <td className="py-3 d-none d-md-table-cell">
                        <small className="text-muted">
                          {(u.roles || []).join(', ')}
                          {u.activeRole ? ` · ${t('pages.admin.roleMgmt.active')}: ${roleLabels[u.activeRole] || u.activeRole}` : ''}
                        </small>
                      </td>
                      <td className="py-3" style={{ minWidth: 140 }}>
                        <select
                          className="form-select form-select-sm rounded-3"
                          value={selected}
                          disabled={isSelf}
                          aria-label={t('pages.admin.roleMgmt.assignAria')}
                          onChange={(e) => onSelectChange(u.id, e.target.value)}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {roleLabels[r] || r}
                            </option>
                          ))}
                        </select>
                        {isSelf && (
                          <div className="small text-muted mt-1">{t('pages.admin.roleMgmt.selfLocked')}</div>
                        )}
                      </td>
                      <td className="pe-3 py-3 text-end">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm rounded-lg px-3"
                          disabled={isSelf || !dirty}
                          onClick={() => setPending({ id: u.id, role: selected, email: u.email, name: u.name })}
                        >
                          {t('pages.admin.roleMgmt.update')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && !listError && (
            <div className="text-muted text-center py-5 small">{t('pages.admin.emptyUsers')}</div>
          )}
        </Card>
      )}

      <ConfirmActionModal
        show={Boolean(pending)}
        title={t('pages.admin.roleMgmt.confirmTitle')}
        message={
          pending
            ? t('pages.admin.roleMgmt.confirmBody', {
                name: pending.name,
                email: pending.email,
                role: roleLabels[pending.role] || pending.role
              })
            : ''
        }
        confirmText={t('pages.admin.roleMgmt.update')}
        confirmVariant="primary"
        onClose={() => setPending(null)}
        onConfirm={applyPatch}
      />
    </div>
  );
};

export default AdminRoleManagement;
