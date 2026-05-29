import React, { useMemo } from 'react';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const hasCardImages = (t) =>
  Boolean(t?.truckCardFrontImage && t?.truckCardBackImage);

const VehicleCard = ({ truck }) => {
  const { t } = useLanguage();
  const docsOk = useMemo(() => hasCardImages(truck), [truck]);
  const dash = t('common.emDash');
  const fleetStatus = String(truck?.status || 'active').toLowerCase();
  const statusVariant =
    fleetStatus === 'active' ? 'success' : fleetStatus === 'suspended' ? 'danger' : 'warning';
  const statusLabel =
    fleetStatus === 'active'
      ? t('pages.fleet.statusActive')
      : fleetStatus === 'suspended'
        ? t('pages.fleet.statusSuspended')
        : t('pages.fleet.statusPending');

  const title = truck?.licensePlate?.trim() || truck?.engineNumber || dash;
  const engine = truck?.engineNumber?.trim();
  const sub = t('pages.fleet.truckTypeLine', {
    type: truck?.truckType || dash,
    capacity: truck?.capacity ?? 0
  });

  return (
    <Card className="h-100 tp-fleet-vehicle-card">
      <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
        <h6 className="mb-0 text-break">{title}</h6>
        <div className="d-flex flex-column align-items-end gap-1 flex-shrink-0">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          <Badge variant={docsOk ? 'success' : 'warning'}>
            {docsOk ? t('pages.fleet.statusDocsComplete') : t('pages.fleet.statusDocsIncomplete')}
          </Badge>
        </div>
      </div>
      <div className="small text-muted mb-1">{sub}</div>
      {engine ? (
        <div className="small text-body-secondary">{t('pages.fleet.engineRef', { eng: engine })}</div>
      ) : null}
    </Card>
  );
};

export default VehicleCard;
