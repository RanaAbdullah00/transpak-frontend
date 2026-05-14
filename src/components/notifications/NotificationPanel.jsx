import React, { useEffect, useMemo, useState, useCallback } from 'react';
import NotificationItem from './NotificationItem.jsx';
import { AppContext } from '../../context/AppContext.jsx';
import api from '../../services/api.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { sanitizeNotificationRoleType } from '../../utils/notificationsFilter.js';

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

const NotificationPanel = () => {
  const { t, isUrdu } = useLanguage();
  const app = React.useContext(AppContext);
  const notifications = useMemo(
    () => (Array.isArray(app?.notifications) ? app.notifications : []),
    [app?.notifications]
  );
  const markNotificationRead = app?.markNotificationRead || (() => {});
  const [persisted, setPersisted] = useState([]);

  const fetchPersisted = useCallback(async () => {
    const token = localStorage.getItem('transpak_token');
    if (!token) return;
    try {
      const res = await api.get('/notifications');
      const rows = Array.isArray(res?.data) ? res.data : [];
      setPersisted(
        rows.map((r) => ({
          ...r,
          id: r.id || r._id,
          roleType: sanitizeNotificationRoleType(r.roleType),
          type: r.type != null && String(r.type).trim() !== '' ? String(r.type).trim() : null,
          message: r.message || r.title || ''
        }))
      );
    } catch {
      setPersisted([]);
    }
  }, []);

  useEffect(() => {
    fetchPersisted();
  }, [fetchPersisted]);

  useEffect(() => {
    const handler = () => fetchPersisted();
    window.addEventListener('tp_notifications_read', handler);
    return () => window.removeEventListener('tp_notifications_read', handler);
  }, [fetchPersisted]);

  const sorted = useMemo(() => {
    const byKey = new Map();
    persisted.forEach((n) => {
      const id = String(n.id || n._id || '');
      if (id) byKey.set(id, n);
      else byKey.set(`p-${n.message}-${n.createdAt}`, n);
    });
    notifications.forEach((n) => {
      const id = String(n.id || n._id || '');
      if (id) {
        if (!byKey.has(id)) byKey.set(id, n);
        return;
      }
      const k = `e-${n.message}-${n.createdAt}`;
      if (!byKey.has(k)) byKey.set(k, n);
    });
    return [...byKey.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notifications, persisted]);

  const { today, older } = useMemo(() => {
    const t0 = startOfDay(new Date());
    const a = [];
    const b = [];
    sorted.forEach((n) => {
      const ts = new Date(n.createdAt).getTime();
      if (!Number.isFinite(ts)) {
        b.push(n);
        return;
      }
      if (startOfDay(new Date(n.createdAt)) === t0) a.push(n);
      else b.push(n);
    });
    return { today: a, older: b };
  }, [sorted]);

  const handleOpen = (n) => {
    markNotificationRead(n._id || n.id);
    const id = String(n.id || n._id || '');
    if (id) {
      api
        .patch(`/notifications/${id}/read`)
        .then(() => window.dispatchEvent(new CustomEvent('tp_notifications_read')))
        .catch(() => {});
    }
  };

  const renderGroup = (label, items) => {
    if (!items.length) return null;
    return (
      <section className="tp-notif-group mb-3" aria-label={label}>
        <h6 className="tp-notif-group__title small fw-semibold text-body text-uppercase px-1 mb-2">{label}</h6>
        <div className="tp-notif-group__list rounded-3 overflow-hidden">
          {items.map((n) => (
            <NotificationItem
              key={String(n._id || n.id || `${n.message}-${n.createdAt}`)}
              notification={n}
              onClick={() => handleOpen(n)}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className={`container py-3 position-relative tp-notifications-page ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3 text-body fw-semibold">{t('common.notifications')}</h5>
      <div className="tp-notifications-surface rounded-3 p-2 p-md-3">
        {!sorted.length ? (
          <div className="text-center small py-5 px-3 tp-empty-state tp-notifications-empty">
            <div className="fw-semibold mb-1 text-body">{t('pages.notificationsPanel.emptyTitle')}</div>
            <div className="tp-notifications-empty__hint">{t('pages.notificationsPanel.emptyBody')}</div>
          </div>
        ) : (
          <>
            {renderGroup(t('pages.notificationsPanel.groupToday'), today)}
            {renderGroup(t('pages.notificationsPanel.groupEarlier'), older)}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
