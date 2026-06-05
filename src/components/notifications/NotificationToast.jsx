import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useLanguage } from '../../hooks/useLanguage.js';
import { NOTIFICATION_KIND } from '../../utils/notificationEngine.js';
import { resolveNotificationPath } from '../../utils/notificationNavigation.js';
import { notificationUILabels } from '../../utils/i18nLabels.js';
import { useAuth } from '../../hooks/useAuth.js';
import TranslatedText from '../ui/TranslatedText.jsx';

const PRIORITY_CLASS = {
  high: 'tp-toast tp-toast--success',
  medium: 'tp-toast tp-toast--info',
  low: 'tp-toast tp-toast--info'
};

/**
 * Single toast channel — no duplicate routeRealtimeNotification path.
 */
const NotificationToastHost = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const recentRef = useRef(new Set());

  const showToast = useCallback(
    (notification) => {
      const { title, message } = notificationUILabels(t, notification);
      if (!title && !message) return;
      const key = notification.dedupeKey || notification.id;
      if (key && recentRef.current.has(key)) return;
      if (key) {
        recentRef.current.add(key);
        window.setTimeout(() => recentRef.current.delete(key), 10000);
      }

      const kind = notification.kind;
      const path = resolveNotificationPath(notification, { activeRole: user?.activeRole });
      const autoClose = notification.priority === 'high' ? 7000 : 4500;
      const className = PRIORITY_CLASS[notification.priority] || PRIORITY_CLASS.medium;

      const showCta =
        (kind === NOTIFICATION_KIND.CONTRACT && notification.shipmentRef) ||
        (kind === NOTIFICATION_KIND.STATUS_UPDATE && notification.shipmentRef) ||
        (kind === NOTIFICATION_KIND.SUGGEST);

      const ctaLabel =
        kind === NOTIFICATION_KIND.CONTRACT
          ? t('pages.notifications.viewLiveTracking')
          : kind === NOTIFICATION_KIND.STATUS_UPDATE
            ? t('pages.notifications.viewShipment')
            : t('pages.notifications.viewBids');

      const body = (
        <div className="tp-notification-toast">
          {title ? <TranslatedText text={title} as="div" className="fw-semibold small" /> : null}
          {message ? <TranslatedText text={message} as="div" className="small" /> : null}
          {showCta ? (
            <button
              type="button"
              className="btn btn-sm btn-light mt-2 rounded-lg"
              onClick={() => {
                toast.dismiss();
                navigate(path);
              }}
            >
              {ctaLabel}
            </button>
          ) : null}
        </div>
      );

      toast.info(body, {
        autoClose,
        className,
        hideProgressBar: false
      });
    },
    [navigate, t, user?.activeRole]
  );

  useEffect(() => {
    const onToast = (e) => showToast(e?.detail);
    window.addEventListener('tp:notification-toast', onToast);
    return () => window.removeEventListener('tp:notification-toast', onToast);
  }, [showToast]);

  return null;
};

export default NotificationToastHost;
