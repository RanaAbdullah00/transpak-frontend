import React from 'react';
import { Link } from 'react-router-dom';
import Badge from '../ui/Badge.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { FLOW_STATUS, FLOW_TYPE } from '../../utils/flowSession.js';
import { sanitizeBadgeVariant } from '../../utils/badgeVariants.js';

/**
 * Unified active-flow banner for bid flow (Flow A) and capacity match (Flow B).
 */
const FlowSessionBanner = ({
  flowType = FLOW_TYPE.BID,
  status = FLOW_STATUS.ACTIVE,
  trackRef = null,
  carrierMode = false,
  counterpartyName = null,
  className = ''
}) => {
  const { t } = useLanguage();
  const isActive =
    status === FLOW_STATUS.ACTIVE || status === FLOW_STATUS.ACTIVE_CAPACITY_MATCH;
  if (!isActive) return null;

  const isBid = flowType === FLOW_TYPE.BID;
  const title = carrierMode
    ? isBid
      ? t('flowSession.carrierBidActive')
      : t('flowSession.carrierCapacityActive')
    : isBid
      ? t('flowSession.shipperShipmentActive')
      : t('flowSession.shipperCapacityActive');

  const subtitle = counterpartyName
    ? t('flowSession.withCounterparty', { name: counterpartyName })
    : t('flowSession.liveTrackingEnabled');

  return (
    <div
      className={`tp-flow-session-banner tp-flow-session-banner--active tp-animate-fade-in ${className}`.trim()}
      role="status"
    >
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div className="min-w-0">
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span className="fw-semibold">{title}</span>
            <Badge variant={sanitizeBadgeVariant('success')}>{t('flowSession.badgeActive')}</Badge>
          </div>
          <p className="small text-muted mb-0">{subtitle}</p>
        </div>
        {trackRef ? (
          <Link
            to={`/shipments/tracking/${encodeURIComponent(trackRef)}`}
            className="btn btn-sm btn-success flex-shrink-0"
          >
            {t('pages.dashboard.viewLiveTracking')}
          </Link>
        ) : null}
      </div>
    </div>
  );
};

export default FlowSessionBanner;
