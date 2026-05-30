import React from 'react';
import Button from '../ui/Button.jsx';
import FlowTimeline, { SPACE_STEPS } from '../ui/FlowTimeline.jsx';
import ProfileLink from '../profile/ProfileLink.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { spaceStepId } from '../../utils/spaceFlow.js';
import { formatTons } from '../../utils/weightUnits.js';

const SpaceRequestLifecycle = ({ row, onAccept, onReject, onInTransit, onComplete, showCarrierActions }) => {
  const { t } = useLanguage();
  const status = String(row.status || '').toLowerCase();
  const stepId = spaceStepId(status);

  return (
    <div className="border rounded-3 p-3 tp-space-request-row">
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-1">
        <div className="fw-semibold">
          {showCarrierActions ? (
            <ProfileLink userId={row.shipperId} name={row.shipperName} showBadge role={t('auth.shipper')} />
          ) : (
            <ProfileLink userId={row.carrierId} name={row.carrierName} showBadge role={t('auth.carrier')} />
          )}{' '}
          · {formatTons(row.requestedKg)} t
        </div>
        <span className="badge text-bg-secondary text-uppercase">{status.replace('_', ' ')}</span>
      </div>
      <div className="small text-muted mb-2">
        {row.origin} → {row.destination}
      </div>
      <FlowTimeline steps={SPACE_STEPS} currentId={stepId} className="my-2" />
      {status === 'request_sent' && showCarrierActions ? (
        <div className="d-flex gap-2 flex-wrap">
          <Button size="sm" variant="primary" onClick={() => onAccept?.(row.id)}>
            {t('loadsHub.acceptRequest')}
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={() => onReject?.(row.id)}>
            {t('loadsHub.rejectRequest')}
          </Button>
        </div>
      ) : null}
      {status === 'active' ? (
        <Button size="sm" variant="primary" onClick={() => onInTransit?.(row.id)}>
          {t('loadsHub.markInTransit')}
        </Button>
      ) : null}
      {status === 'in_transit' ? (
        <Button size="sm" variant="success" onClick={() => onComplete?.(row.id)}>
          {t('loadsHub.markComplete')}
        </Button>
      ) : null}
      {status === 'completed' ? (
        <p className="small text-muted mb-0">{t('loadsHub.spaceCompletedHint')}</p>
      ) : null}
    </div>
  );
};

export default SpaceRequestLifecycle;
