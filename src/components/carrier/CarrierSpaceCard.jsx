import React, { memo } from 'react';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import VehicleTypeLabel from '../loadboard/VehicleTypeLabel.jsx';
import ProfileAccessLayer from '../profile/ProfileAccessLayer.jsx';
import { formatTons, ratePerKgToTon } from '../../utils/weightUnits.js';
import { canCloseListingWithContract } from '../../utils/contractMapper.js';
import { formatSlotsSummary } from './AvailabilitySlotPicker.jsx';

const CarrierSpaceCard = memo(({ listing, mine, onClose, onRequest, onEdit, onViewDetails }) => {
  const { t } = useLanguage();
  const remTons = formatTons(listing.remainingSpaceKg ?? 0);
  const capTons = formatTons(listing.truckCapacityKg ?? 0);
  const rem = Number(listing.remainingSpaceKg ?? 0);
  const cap = Number(listing.truckCapacityKg ?? 0);
  const pct = cap > 0 ? Math.round((rem / cap) * 100) : 0;
  const canCloseListing = canCloseListingWithContract(listing);

  return (
    <Card className="p-3 h-100 tp-space-card">
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <Badge variant={listing.status === 'open' ? 'success' : 'secondary'}>
          {listing.status === 'open' ? t('loadsHub.statusOpen') : t('loadsHub.statusClosed')}
        </Badge>
        {!mine && listing.carrierId ? (
          <ProfileAccessLayer
            userId={listing.carrierId}
            name={listing.carrierName}
            avatarSrc={listing.carrierAvatar}
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
      {listing.availableFrom || listing.availabilitySlots?.length ? (
        <div className="small text-muted mb-2">
          {listing.availableFrom ? (
            <span>
              {t('loadsHub.availableFrom')}: {String(listing.availableFrom).slice(0, 10)}
            </span>
          ) : null}
          {formatSlotsSummary(listing.availabilitySlots, t) ? (
            <span className={listing.availableFrom ? ' ms-1' : ''}>
              · {formatSlotsSummary(listing.availabilitySlots, t)}
            </span>
          ) : null}
        </div>
      ) : null}
      {mine && listing.status === 'open' ? (
        <div className="d-grid gap-2">
          {onEdit && !Number(listing.acceptedRequestCount) ? (
            <Button variant="outline-primary" size="sm" className="w-100" onClick={() => onEdit(listing)}>
              {t('loadsHub.editListing')}
            </Button>
          ) : null}
          {!canCloseListing ? (
            <p className="small text-muted mb-0">{t('loadsHub.closeListingDisabled')}</p>
          ) : onClose ? (
            <Button variant="outline-secondary" size="sm" className="w-100" onClick={onClose}>
              {t('loadsHub.closeListing')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {!mine && listing.status === 'open' ? (
        <div className="d-grid gap-2 mt-2">
          {onViewDetails ? (
            <Button variant="outline-primary" size="sm" className="w-100" onClick={() => onViewDetails(listing)}>
              {t('loadsHub.viewDetails')}
            </Button>
          ) : null}
          {onRequest ? (
            <Button variant="primary" size="sm" className="w-100" onClick={() => onRequest(listing)}>
              {t('loadsHub.requestCapacity')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
});

CarrierSpaceCard.displayName = 'CarrierSpaceCard';

export default CarrierSpaceCard;
