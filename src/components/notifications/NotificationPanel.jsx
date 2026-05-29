import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';
import NotificationItem from './NotificationItem.jsx';
import Button from '../ui/Button.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { AppContext } from '../../context/AppContext.jsx';
import api from '../../services/api.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useAuth } from '../../hooks/useAuth.js';
import { resolveNotificationPath } from '../../utils/notificationNavigation.js';
import { notificationsForWorkspace } from '../../utils/notificationScope.js';

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

const NotificationPanel = () => {
  const { t, isUrdu } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const app = React.useContext(AppContext);
  const notifications = useMemo(
    () => notificationsForWorkspace(Array.isArray(app?.notifications) ? app.notifications : [], user),
    [app?.notifications, user?.id, user?.activeRole]
  );
  const markNotificationRead = app?.markNotificationRead || (() => {});
  const refetchNotifications = app?.refetchNotifications;
  const loadMoreNotifications = app?.loadMoreNotifications;
  const notificationsHasMore = app?.notificationsHasMore;
  const notificationsLoadingMore = app?.notificationsLoadingMore;

  const sorted = useMemo(() => {
    return [...notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notifications]);

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

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      sorted.forEach((n) => markNotificationRead(n.id || n._id));
      await refetchNotifications?.();
      window.dispatchEvent(new CustomEvent('tp_notifications_read'));
    } catch {
      /* ignore */
    }
  };

  const handleOpen = (n) => {
    markNotificationRead(n._id || n.id);
    const id = String(n.id || n._id || '');
    if (id) {
      api
        .patch(`/notifications/${id}/read`)
        .then(() => {
          window.dispatchEvent(new CustomEvent('tp_notifications_read'));
          return refetchNotifications?.();
        })
        .catch(() => {});
    }
    navigate(resolveNotificationPath(n, { activeRole: user?.activeRole }));
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

  const unreadCount = sorted.filter((n) => !n.read && !n.isRead).length;

  return (
    <div className={`container py-3 position-relative tp-notifications-page ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap">
        <h5 className="mb-0 text-body fw-semibold">{t('common.notifications')}</h5>
        {unreadCount > 0 ? (
          <Button variant="outline-primary" size="sm" className="rounded-lg" onClick={markAllRead}>
            {t('pages.notificationsPanel.markAllRead')}
          </Button>
        ) : null}
      </div>
      <div className="tp-notifications-surface rounded-3 p-2 p-md-3">
        {!sorted.length ? (
          <EmptyState
            icon={FaBell}
            title={t('empty.notificationsTitle')}
            body={t('empty.notificationsBody')}
            className="tp-notifications-empty border-0"
          />
        ) : (
          <>
            {renderGroup(t('pages.notificationsPanel.groupToday'), today)}
            {renderGroup(t('pages.notificationsPanel.groupEarlier'), older)}
            {notificationsHasMore ? (
              <div className="text-center pt-2">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm rounded-lg"
                  disabled={notificationsLoadingMore}
                  onClick={() => loadMoreNotifications?.()}
                >
                  {notificationsLoadingMore
                    ? t('common.loading')
                    : t('pages.notificationsPanel.loadMore')}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
