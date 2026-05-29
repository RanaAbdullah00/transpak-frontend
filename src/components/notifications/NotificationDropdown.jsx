import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaBell, FaTimes } from 'react-icons/fa';
import NotificationItem from './NotificationItem.jsx';
import Button from '../ui/Button.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { AppContext } from '../../context/AppContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import api from '../../services/api.js';
import { notifyError } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notificationsForUser } from '../../utils/notificationScope.js';
import { getPortalContainer } from '../../utils/portalRoot.js';
import { resolveAdminShell } from '../../utils/rbac.js';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveNotificationPath } from '../../utils/notificationNavigation.js';
import { playNotificationSound } from '../../utils/notificationSound.js';

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function groupByRole(notifications, t, adminShell) {
  if (adminShell) {
    return [{ key: 'admin', label: null, items: notifications }];
  }
  const shipper = [];
  const carrier = [];
  const general = [];
  notifications.forEach((n) => {
    const rt = String(n.roleType || '').toLowerCase();
    if (rt === 'shipper') shipper.push(n);
    else if (rt === 'carrier') carrier.push(n);
    else general.push(n);
  });
  const sections = [];
  if (general.length) sections.push({ key: 'general', label: null, items: general });
  if (shipper.length) sections.push({ key: 'shipper', label: t('pages.notificationsPanel.groupShipper'), items: shipper });
  if (carrier.length) sections.push({ key: 'carrier', label: t('pages.notificationsPanel.groupCarrier'), items: carrier });
  return sections;
}

const NotificationDropdown = ({ className = '' }) => {
  const { t, isUrdu } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const adminShell = resolveAdminShell(user, location.pathname);
  const app = React.useContext(AppContext);
  const [open, setOpen] = useState(false);
  const [serverUnread, setServerUnread] = useState(0);
  const rootRef = useRef(null);

  const allNotifications = useMemo(
    () => (Array.isArray(app?.notifications) ? app.notifications : []),
    [app?.notifications]
  );
  const notifications = useMemo(
    () => notificationsForUser(allNotifications, user),
    [allNotifications, user?.id, user?.activeRole]
  );
  const markNotificationRead = app?.markNotificationRead || (() => {});
  const refetchNotifications = app?.refetchNotifications;

  const roles = useMemo(() => {
    if (!user) return [];
    return Array.isArray(user.roles) && user.roles.length ? user.roles : [user.activeRole].filter(Boolean);
  }, [user]);
  const dualRole = !adminShell && roles.includes('shipper') && roles.includes('carrier');

  const contextUnread = notifications.filter((n) => !(n.read || n.isRead)).length;
  const unreadCount = Math.max(contextUnread, serverUnread);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setServerUnread(0);
        return;
      }
      try {
        const res = await api.get('/notifications/unread-count', { skipGlobalErrorToast: true });
        const n = typeof res.data?.count === 'number' ? res.data.count : 0;
        setServerUnread(n);
      } catch {
        setServerUnread(0);
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

  useEffect(() => {
    if (!open) {
      document.body.classList.remove('tp-notif-panel-open');
      return undefined;
    }
    document.body.classList.add('tp-notif-panel-open');
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.classList.remove('tp-notif-panel-open');
    };
  }, [open]);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('tp:role-switched', close);
    return () => window.removeEventListener('tp:role-switched', close);
  }, []);

  useEffect(() => {
    if (!open) return;
    refetchNotifications?.();
  }, [open, refetchNotifications]);

  useEffect(() => {
    const onNew = () => playNotificationSound();
    window.addEventListener('tp:notification-sound', onNew);
    return () => window.removeEventListener('tp:notification-sound', onNew);
  }, []);

  const sorted = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [notifications]
  );

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

  const roleSectionsToday = useMemo(
    () => (dualRole || adminShell ? groupByRole(today, t, adminShell) : [{ key: 'all', label: null, items: today }]),
    [dualRole, adminShell, today, t]
  );
  const roleSectionsOlder = useMemo(
    () => (dualRole || adminShell ? groupByRole(older, t, adminShell) : [{ key: 'all', label: null, items: older }]),
    [dualRole, adminShell, older, t]
  );

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      sorted.forEach((n) => markNotificationRead(n.id || n._id));
      await refetchNotifications?.();
      window.dispatchEvent(new CustomEvent('tp_notifications_read'));
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.notificationsPanel.markAllFailed') }));
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
    const path = resolveNotificationPath(n, { activeRole: user?.activeRole });
    setOpen(false);
    navigate(path);
  };

  const renderItems = (items) =>
    items.map((n) => (
      <NotificationItem
        key={String(n._id || n.id || `${n.message}-${n.createdAt}`)}
        notification={n}
        onClick={() => handleOpen(n)}
      />
    ));

  const renderRoleSections = (sections) =>
    sections.map((section) => {
      if (!section.items.length) return null;
      return (
        <div key={section.key} className="tp-notif-role-block mb-2">
          {section.label ? (
            <div className="tp-notif-role-block__label small fw-semibold text-uppercase px-2 mb-1">
              {section.label}
            </div>
          ) : null}
          <div className="tp-notif-group__list">{renderItems(section.items)}</div>
        </div>
      );
    });

  const renderTimeGroup = (label, sections) => {
    const total = sections.reduce((n, s) => n + s.items.length, 0);
    if (!total) return null;
    return (
      <section className="tp-notif-group mb-2" aria-label={label}>
        <h6 className="tp-notif-group__title small fw-semibold text-body text-uppercase px-2 mb-1">{label}</h6>
        {renderRoleSections(sections)}
      </section>
    );
  };

  const panel = open ? (
    <div className={`tp-notif-slide ${isUrdu && !adminShell ? 'tp-rtl' : ''}`} role="presentation">
      <button
        type="button"
        className="tp-notif-slide__backdrop"
        aria-label={t('nav.close')}
        onClick={() => setOpen(false)}
      />
      <aside
        className="tp-notif-slide__panel shadow-lg"
        role="dialog"
        aria-label={t('common.notifications')}
        ref={rootRef}
      >
        <div className="tp-notif-slide__head d-flex justify-content-between align-items-center gap-2 px-3 py-3 border-bottom tp-border-theme">
          <span className="fw-semibold">{t('common.notifications')}</span>
          <div className="d-flex align-items-center gap-2">
            {contextUnread > 0 ? (
              <Button variant="outline-primary" size="sm" className="rounded-lg py-0 px-2" onClick={markAllRead}>
                {t('pages.notificationsPanel.markAllRead')}
              </Button>
            ) : null}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-lg d-flex align-items-center justify-content-center"
              aria-label={t('nav.close')}
              onClick={() => setOpen(false)}
            >
              <FaTimes size={14} />
            </button>
          </div>
        </div>
        <div className="tp-notif-slide__scroll px-2 py-2">
          {!sorted.length ? (
            <EmptyState
              icon={FaBell}
              title={t('empty.notificationsTitle')}
              body={t('empty.notificationsBody')}
              className="border-0 py-4"
            />
          ) : (
            <>
              {renderTimeGroup(t('pages.notificationsPanel.groupToday'), roleSectionsToday)}
              {renderTimeGroup(t('pages.notificationsPanel.groupEarlier'), roleSectionsOlder)}
            </>
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
        className="btn btn-outline-secondary btn-sm rounded-lg position-relative d-flex align-items-center justify-content-center gap-1"
        aria-label={t('nav.notificationsAria')}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) refetchNotifications?.();
            return next;
          });
        }}
      >
        <FaBell size={14} />
        {unreadCount > 0 ? (
          <span className="badge rounded-pill bg-danger tp-badge-xs">{unreadCount > 99 ? '99+' : unreadCount}</span>
        ) : null}
      </button>
      {host && panel ? createPortal(panel, host) : panel}
    </div>
  );
};

export default NotificationDropdown;
