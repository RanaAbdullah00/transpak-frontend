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
        <Badge variant={docsOk ? 'success' : 'warning'} className="flex-shrink-0">
          {docsOk ? t('pages.fleet.statusDocsComplete') : t('pages.fleet.statusDocsIncomplete')}
        </Badge>
      </div>
      <div className="small text-muted mb-1">{sub}</div>
      {engine ? (
        <div className="small text-body-secondary">{t('pages.fleet.engineRef', { eng: engine })}</div>
      ) : null}
    </Card>
  );
};

export default VehicleCard;
