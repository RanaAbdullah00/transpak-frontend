import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';
import TranslatedText from '../ui/TranslatedText.jsx';
import RelativeTime from '../ui/RelativeTime.jsx';
import ProfileAccessLayer from '../profile/ProfileAccessLayer.jsx';
import { notificationUILabels, translateNotificationType } from '../../utils/i18nLabels.js';

const NotificationItem = ({ notification, onClick }) => {
  const { t } = useLanguage();
  const role = notification.roleType;
  const typeLbl = notification.type ? translateNotificationType(t, notification.type) : '';
  const { message: displayMessage } = notificationUILabels(t, notification);
  const unread = !(notification.read || notification.isRead);

  const roleBadge =
    role === 'carrier'
      ? { cls: 'tp-notif-role-badge--carrier', label: t('nav.carrierShort') }
      : role === 'shipper'
      ? { cls: 'tp-notif-role-badge--shipper', label: t('nav.shipperShort') }
      : role === 'admin'
      ? { cls: 'tp-notif-role-badge--admin', label: t('common.admin') }
      : null;

  return (
    <button
      type="button"
      className={`tp-notif-item w-100 text-start border-0 ${unread ? 'tp-notif-item--unread' : ''}`}
      onClick={onClick}
    >
      <div className="tp-notif-item__row">
        <div className="tp-notif-item__main min-w-0">
          <div className="tp-notif-item__meta d-flex align-items-center flex-wrap gap-2 mb-1">
            {roleBadge ? (
              <span className={`tp-notif-role-badge rounded-pill ${roleBadge.cls}`}>{roleBadge.label}</span>
            ) : null}
            {typeLbl ? (
              <span className="small text-uppercase tp-notif-item__type">{typeLbl}</span>
            ) : null}
            {notification.createdAt ? (
              <RelativeTime iso={notification.createdAt} className="small tp-notif-item__time ms-auto" />
            ) : null}
          </div>
          {notification.senderId ? (
            <div className="small mb-1">
              <ProfileAccessLayer userId={notification.senderId} name={t('notifications.viewProfile')} />
            </div>
          ) : null}
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
