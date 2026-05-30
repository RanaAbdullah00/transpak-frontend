import React, { useCallback, useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { ensureArray, ensureRolesArray } from '../../utils/unwrapApi.js';
import { notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { useSearchParams } from 'react-router-dom';

const AdminUsers = () => {
  const { request } = useApi();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') || '';
  const roleFilter = searchParams.get('role') || '';
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPendingDelete, setUserPendingDelete] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (filter === 'incomplete') params.verified = 'false';
      const data = await request({ url: '/admin/users', params, expectList: true });
      let rows = ensureArray(data);
      if (filter === 'active') {
        rows = rows.filter((u) => !u.blocked && u.verified !== false);
      } else if (filter === 'incomplete') {
        rows = rows.filter((u) => !u.profileComplete);
      }
      setUsers(rows);
    } catch (e) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [request, filter, roleFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setBlocked = async (id, blocked) => {
    try {
      const res = await request({ method: 'PATCH', url: `/admin/users/${id}/block`, data: { blocked } });
      const u = res?.user;
      setUsers((prev) => prev.map((x) => (x.id === id ? { ...x, blocked: u?.blocked ?? blocked } : x)));
      notifySuccess(blocked ? t('pages.admin.userBlocked') : t('pages.admin.userUnblocked'));
    } catch {
      /* useApi → notifyApiError */
    }
  };

  const confirmDeleteUser = async () => {
    if (!userPendingDelete?.id) return;
    try {
      await request({ method: 'DELETE', url: `/admin/user/${userPendingDelete.id}` });
      setUsers((prev) => prev.filter((x) => x.id !== userPendingDelete.id));
      notifySuccess(t('pages.admin.userDeleted'));
    } catch {
      /* useApi → notifyApiError */
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('pages.admin.usersTitle')}</h5>
      {loading ? (
        <SkeletonTable cols={6} rows={8} />
      ) : users.length === 0 ? (
        <div className="text-muted text-center py-5">{t('pages.admin.emptyUsers')}</div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover table-sm mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th className="ps-3 py-3">{t('auth.fullName')}</th>
                  <th className="py-3">{t('auth.email')}</th>
                  <th className="py-3 d-none d-md-table-cell">{t('auth.cnic')}</th>
                  <th className="py-3">{t('auth.role')}</th>
                  <th className="py-3 text-end">{t('pages.admin.block')}</th>
                  <th className="pe-3 py-3 text-end">{t('pages.admin.deleteUser')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isAdmin = ensureRolesArray(u.roles).includes('admin');
                  return (
                    <tr key={u.id}>
                      <td className="ps-3 py-3 fw-semibold">{u.name}</td>
                      <td className="py-3">
                        <small>{u.email}</small>
                      </td>
                      <td className="py-3 d-none d-md-table-cell">
                        <small className="text-muted">{u.cnic}</small>
                      </td>
                      <td className="py-3">
                        <span className="badge bg-secondary">{ensureRolesArray(u.roles).join(', ')}</span>
                      </td>
                      <td className="py-3 text-end">
                        <Button
                          variant={u.blocked ? 'success' : 'outline-danger'}
                          onClick={() => setBlocked(u.id, !u.blocked)}
                          className="btn-sm rounded-lg"
                        >
                          {u.blocked ? t('pages.admin.unblock') : t('pages.admin.block')}
                        </Button>
                      </td>
                      <td className="pe-3 py-3 text-end">
                        <Button
                          variant="outline-danger"
                          disabled={isAdmin}
                          title={isAdmin ? t('pages.admin.deleteUserDisabledAdmin') : undefined}
                          onClick={() => !isAdmin && setUserPendingDelete(u)}
                          className="btn-sm rounded-lg"
                        >
                          {t('pages.admin.deleteUser')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmActionModal
        show={Boolean(userPendingDelete)}
        title={t('pages.admin.deleteUserTitle')}
        message={t('pages.admin.deleteUserMessage')}
        confirmText={t('pages.admin.deleteUser')}
        confirmVariant="danger"
        onClose={() => setUserPendingDelete(null)}
        onConfirm={confirmDeleteUser}
      />
    </div>
  );
};

export default AdminUsers;
