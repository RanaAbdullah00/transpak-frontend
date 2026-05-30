import React, { memo } from 'react';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import VehicleTypeLabel from '../loadboard/VehicleTypeLabel.jsx';
import ProfileLink from '../profile/ProfileLink.jsx';
import { formatTons, ratePerKgToTon } from '../../utils/weightUnits.js';

const CarrierSpaceCard = memo(({ listing, mine, onClose, onRequest }) => {
  const { t } = useLanguage();
  const remTons = formatTons(listing.remainingSpaceKg ?? 0);
  const capTons = formatTons(listing.truckCapacityKg ?? 0);
  const rem = Number(listing.remainingSpaceKg ?? 0);
  const cap = Number(listing.truckCapacityKg ?? 0);
  const pct = cap > 0 ? Math.round((rem / cap) * 100) : 0;

  return (
    <Card className="p-3 h-100 tp-space-card">
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <Badge variant={listing.status === 'open' ? 'success' : 'secondary'}>
          {listing.status === 'open' ? t('loadsHub.statusOpen') : t('loadsHub.statusClosed')}
        </Badge>
        {!mine && listing.carrierId ? (
          <ProfileLink
            userId={listing.carrierId}
            name={listing.carrierName}
            className="small text-truncate"
            showBadge
            role={t('auth.carrier')}
          />
        ) : null}
      </div>
      <div className="fw-semibold mb-1">
        {listing.origin} → {listing.destination}
      </div>
      <div className="small text-muted mb-2">
        <VehicleTypeLabel value={listing.vehicleType || 'Truck'} /> ·{' '}
        {remTons} / {capTons} {t('loadsHub.tonsUnit')}
      </div>
      <div className="progress tp-progress-thin mb-2">
        <div
          className="progress-bar bg-success tp-progress-bar"
          role="progressbar"
          style={{ '--tp-progress': `${Math.min(100, pct)}%` }}
          aria-valuenow={pct}
        />
      </div>
      {listing.ratePerKg != null ? (
        <div className="small mb-2">
          {t('loadsHub.ratePerKg', {
            rate: Number(ratePerKgToTon(listing.ratePerKg)).toLocaleString()
          })}
        </div>
      ) : null}
      {mine && listing.status === 'open' && onClose ? (
        <Button variant="outline-secondary" size="sm" className="w-100" onClick={onClose}>
          {t('loadsHub.closeListing')}
        </Button>
      ) : null}
      {!mine && listing.status === 'open' && onRequest ? (
        <Button variant="primary" size="sm" className="w-100 mt-2" onClick={() => onRequest(listing)}>
          {t('loadsHub.requestCapacity')}
        </Button>
      ) : null}
    </Card>
  );
});

CarrierSpaceCard.displayName = 'CarrierSpaceCard';

export default CarrierSpaceCard;
