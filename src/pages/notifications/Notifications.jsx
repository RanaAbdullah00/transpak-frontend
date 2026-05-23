import React, { useEffect } from 'react';
import NotificationPanel from '../../components/notifications/NotificationPanel.jsx';
import { AppContext } from '../../context/AppContext.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const Notifications = () => {
  const { t, isUrdu } = useLanguage();
  const app = React.useContext(AppContext);

  useEffect(() => {
    app?.refetchNotifications?.();
  }, [app?.refetchNotifications]);

  const unread = Array.isArray(app?.notifications)
    ? app.notifications.filter((n) => !(n.read || n.isRead)).length
    : 0;

  return (
    <div className={isUrdu ? 'tp-rtl' : ''}>
      <div className="container pt-3 pb-0">
        <p className="small text-muted mb-0">{t('pages.notificationsPanel.historyLead')}</p>
        {unread > 0 ? (
          <span className="badge bg-primary mt-2 tp-badge-sm">
            {t('pages.notificationsPanel.unreadBadge', { count: unread })}
          </span>
        ) : null}
      </div>
      <NotificationPanel />
    </div>
  );
};

export default Notifications;
