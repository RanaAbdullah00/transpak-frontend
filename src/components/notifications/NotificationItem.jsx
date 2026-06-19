import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';
import TranslatedText from '../ui/TranslatedText.jsx';
import RelativeTime from '../ui/RelativeTime.jsx';
import { notificationUILabels } from '../../utils/i18nLabels.js';

const NotificationItem = ({ notification, onClick }) => {
  const { t } = useLanguage();
  const { message: displayMessage } = notificationUILabels(t, notification);
  const unread = !(notification.read || notification.isRead);

  return (
    <button
      type="button"
      className={`tp-notif-item w-100 text-start border-0 ${unread ? 'tp-notif-item--unread' : ''}`}
      onClick={onClick}
    >
      <div className="tp-notif-item__row">
        <div className="tp-notif-item__main min-w-0">
          <div className="tp-notif-item__meta d-flex align-items-center flex-wrap gap-2 mb-1">
            {notification.createdAt ? (
              <RelativeTime iso={notification.createdAt} className="small tp-notif-item__time" />
            ) : null}
          </div>
          <div className="tp-notif-item__message small text-body">
            {displayMessage ? <TranslatedText text={displayMessage} className="" /> : null}
          </div>
        </div>
        {unread ? (
          <span className="tp-notif-item__dot flex-shrink-0" aria-label={t('notifications.badgeNew')} />
        ) : null}
      </div>
    </button>
  );
};

export default NotificationItem;
