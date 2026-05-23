import React from 'react';
import { Link } from 'react-router-dom';
import { FaRoute } from 'react-icons/fa';
import { useLanguage } from '../../hooks/useLanguage.js';
import LifecycleBadge from '../shipment/LifecycleBadge.jsx';

const ActiveTripBanner = ({ trackingData, trackRef }) => {
  const { t } = useLanguage();
  if (!trackingData && !trackRef) return null;

  const ref = trackingData?.refKey || trackRef;
  const href = ref ? `/shipments/tracking/${encodeURIComponent(ref)}` : null;
  const origin = trackingData?.origin || '';
  const destination = trackingData?.destination || '';

  return (
    <div className="tp-active-trip-banner alert alert-primary d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div className="d-flex align-items-center gap-2">
        <FaRoute className="flex-shrink-0" aria-hidden />
        <div>
          <div className="fw-semibold">{t('pages.dashboard.activeTripMode')}</div>
          <div className="small mb-0">
            {origin && destination ? `${origin} → ${destination}` : t('pages.dashboard.activeTripSharing')}
          </div>
        </div>
      </div>
      <div className="d-flex align-items-center gap-2">
        <LifecycleBadge stage={trackingData?.lifecycleStage || trackingData?.tracking?.status} />
        {href ? (
          <Link to={href} className="btn btn-sm btn-light">
            {t('pages.dashboard.openFullMap')}
          </Link>
        ) : null}
      </div>
    </div>
  );
};

export default ActiveTripBanner;
