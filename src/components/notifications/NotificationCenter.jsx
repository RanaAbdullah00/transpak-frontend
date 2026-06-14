import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { FaBell, FaTimes } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import NotificationItem from './NotificationItem.jsx';
import Button from '../ui/Button.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import SegmentTabs from '../ui/SegmentTabs.jsx';
import { AppContext } from '../../context/AppContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import api from '../../services/api.js';
import { fetchUnreadCount } from '../../utils/realtimeSync.js';
import { notificationQueryParams } from '../../utils/workspaceApi.js';
import { notifyError } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { notificationsForUser, notificationsForRelatedRole, userHasDualCommercialRoles } from '../../utils/notificationScope.js';
import { getPortalContainer } from '../../utils/portalRoot.js';
import { resolveAdminShell } from '../../utils/rbac.js';
import { resolveNotificationPath } from '../../utils/notificationNavigation.js';
import {
  getNotificationSnapshot,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications
} from '../../utils/notificationStore.js';
import { NOTIFICATION_CATEGORY } from '../../utils/notificationEngine.js';

function mergeNotificationLists(apiRows = [], storeRows = []) {
  const byId = new Map();
  [...apiRows, ...storeRows].forEach((n) => {
    const id = String(n.id || n._id || n.dedupeKey || `${n.message}-${n.createdAt || n.timestamp}`);
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, {
        ...n,
        id: n.id || n._id || id,
        createdAt: n.createdAt || n.timestamp,
        read: Boolean(n.read || n.isRead)
      });
      return;
    }
    byId.set(id, { ...existing, ...n, read: Boolean(n.read && existing.read) });
  });
  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt || b.timestamp).getTime() - new Date(a.createdAt || a.timestamp).getTime()
  );
}

const NotificationCenter = ({ className = '' }) => {
  const { t, isUrdu } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const adminShell = resolveAdminShell(user, location.pathname);
  const app = React.useContext(AppContext);
  const [open, setOpen] = React.useState(false);
  const [filterTab, setFilterTab] = React.useState('all');
  const [relatedRoleView, setRelatedRoleView] = React.useState(false);
  const [serverUnread, setServerUnread] = React.useState(0);
  const [serverUnreadReady, setServerUnreadReady] = React.useState(false);

  const storeRows = useSyncExternalStore(
    subscribeNotifications,
    getNotificationSnapshot,
    getNotificationSnapshot
  );

  const apiRows = useMemo(
    () => (Array.isArray(app?.notifications) ? app.notifications : []),
    [app?.notifications]
  );

  const notifications = useMemo(() => {
    const merged = mergeNotificationLists(apiRows, storeRows);
    return notificationsForUser(merged, user);
  }, [apiRows, storeRows, user]);

  const filtered = useMemo(() => {
    const base = relatedRoleView ? notificationsForRelatedRole(notifications, user) : notifications;
    if (filterTab === 'all') return base;
    return base.filter((n) => {
      const cat = String(n.category || '').toLowerCase();
      if (filterTab === 'contract') return cat === NOTIFICATION_CATEGORY.CONTRACT;
      if (filterTab === 'bid') return cat === NOTIFICATION_CATEGORY.BID;
      if (filterTab === 'status') return cat === NOTIFICATION_CATEGORY.STATUS;
      return true;
    });
  }, [notifications, filterTab, relatedRoleView, user]);

  const markNotificationReadCtx = app?.markNotificationRead || (() => {});
  const refetchNotifications = app?.refetchNotifications;

  const contextUnread = notifications.filter((n) => !(n.read || n.isRead)).length;
  const storeUnread = getUnreadCount();
  const unreadCount = serverUnreadReady ? serverUnread : Math.max(contextUnread, storeUnread);

  const filterTabs = useMemo(
    () => [
      { id: 'all', label: t('pages.notifications.filterAll') },
      { id: 'contract', label: t('pages.notifications.filterContract') },
      { id: 'bid', label: t('pages.notifications.filterBid') },
      { id: 'status', label: t('pages.notifications.filterStatus') }
    ],
    [t]
  );

  React.useEffect(() => {
    const load = async () => {
      if (!user) {
        setServerUnread(0);
        setServerUnreadReady(false);
        return;
      }
      try {
        const n = await fetchUnreadCount(user);
        setServerUnread(n);
        setServerUnreadReady(true);
      } catch {
        /* keep last known server count — avoid false zero flash */
      }
    };
    load();
    const onRead = () => load();
    const onUnreadSync = (e) => {
      const n = e?.detail?.count;
      if (typeof n === 'number') setServerUnread(n);
      else load();
    };
    window.addEventListener('tp_notifications_read', onRead);
    window.addEventListener('tp:unread-sync', onUnreadSync);
    return () => {
      window.removeEventListener('tp_notifications_read', onRead);
      window.removeEventListener('tp:unread-sync', onUnreadSync);
    };
  }, [user?.id, user?.activeRole]);

  React.useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('tp-notif-panel-open');
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onEsc);
    refetchNotifications?.();
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.classList.remove('tp-notif-panel-open');
    };
  }, [open, refetchNotifications]);


  const syncUnreadFromServer = async () => {
    if (!user) {
      setServerUnread(0);
      setServerUnreadReady(false);
      return;
    }
    try {
      const count = await fetchUnreadCount(user);
      setServerUnread(count);
      setServerUnreadReady(true);
      window.dispatchEvent(new CustomEvent('tp:unread-sync', { detail: { count } }));
    } catch {
      /* refetch still reconciles list */
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all', undefined, {
        params: notificationQueryParams(user),
        skipGlobalErrorToast: true
      });
      markAllNotificationsRead();
      filtered.forEach((n) => markNotificationReadCtx(n.id || n._id));
      await refetchNotifications?.();
      await syncUnreadFromServer();
      window.dispatchEvent(new CustomEvent('tp_notifications_read'));
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.notificationsPanel.markAllFailed') }));
    }
  };

  const handleOpen = useCallback(
    (n) => {
      const id = String(n.id || n._id || '');
      markNotificationRead(id);
      markNotificationReadCtx(id);
      if (id) {
        api
          .patch(`/notifications/${id}/read`, undefined, {
            params: notificationQueryParams(user),
            skipGlobalErrorToast: true
          })
          .then(() => syncUnreadFromServer())
          .catch(() => {});
      }
      const path = resolveNotificationPath(n, { activeRole: user?.activeRole });
      setOpen(false);
      navigate(path);
    },
    [markNotificationReadCtx, navigate, user, user?.activeRole]
  );

  const panel = open ? (
    <div className={`tp-notif-slide ${isUrdu && !adminShell ? 'tp-rtl' : ''}`} role="presentation">
      <button
        type="button"
        className="tp-notif-slide__backdrop"
        aria-label={t('nav.close')}
        onClick={() => setOpen(false)}
      />
      <aside className="tp-notif-slide__panel shadow-lg" role="dialog" aria-label={t('common.notifications')}>
        <div className="tp-notif-slide__head d-flex justify-content-between align-items-center gap-2 px-3 py-3 border-bottom tp-border-theme">
          <span className="fw-semibold">{t('common.notifications')}</span>
          <div className="d-flex align-items-center gap-2">
            {unreadCount > 0 ? (
              <Button variant="outline-primary" size="sm" className="rounded-lg py-0 px-2" onClick={markAllRead}>
                {t('pages.notificationsPanel.markAllRead')}
              </Button>
            ) : null}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-lg"
              aria-label={t('nav.close')}
              onClick={() => setOpen(false)}
            >
              <FaTimes size={14} />
            </button>
          </div>
        </div>
        <div className="px-2 pt-2">
          <SegmentTabs tabs={filterTabs} active={filterTab} onChange={setFilterTab} className="mb-2" />
          {userHasDualCommercialRoles(user) ? (
            <Button
              variant={relatedRoleView ? 'primary' : 'outline-secondary'}
              size="sm"
              className="w-100 mb-2 rounded-lg"
              onClick={() => setRelatedRoleView((v) => !v)}
            >
              {relatedRoleView
                ? t('pages.notifications.viewAllRoles')
                : t('pages.notifications.viewRelatedRoleActivity')}
            </Button>
          ) : null}
        </div>
        <div className="tp-notif-slide__scroll px-2 py-2">
          {!filtered.length ? (
            <EmptyState
              icon={FaBell}
              title={t('empty.notificationsTitle')}
              body={t('empty.notificationsBody')}
              className="border-0 py-4"
            />
          ) : (
            filtered.map((n) => (
              <NotificationItem
                key={String(n.id || n.dedupeKey || n.message)}
                notification={n}
                onClick={() => handleOpen(n)}
              />
            ))
          )}
        </div>
      </aside>
    </div>
  ) : null;

  const host = getPortalContainer();

  return (
    <div className={`tp-notif-trigger position-relative ${className}`}>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm rounded-lg position-relative d-flex align-items-center justify-content-center"
        aria-label={t('nav.notificationsAria')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FaBell size={14} />
        {unreadCount > 0 ? (
          <span className="badge rounded-pill bg-danger tp-badge-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>
      {host && panel ? createPortal(panel, host) : panel}
    </div>
  );
};

export default NotificationCenter;
