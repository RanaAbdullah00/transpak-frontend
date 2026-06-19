import React from 'react';
import Card from '../ui/Card.jsx';
import StatusBadge from './StatusBadge.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { formatRouteLabel } from '../../utils/routeDisplay.js';

const ShipmentCard = ({ shipment, uiState = null, profileLink = null }) => {
  const { t } = useLanguage();
  const routeLabel = formatRouteLabel(shipment?.origin, shipment?.destination, t);
  const eta =
    shipment?.eta != null && String(shipment.eta).trim() !== ''
      ? shipment.eta
      : t('common.notSet');
  const lastUpdate =
    shipment?.lastUpdate != null && String(shipment.lastUpdate).trim() !== ''
      ? shipment.lastUpdate
      : t('common.notSet');

  return (
    <Card>
      <div className="d-flex justify-content-between align-items-center mb-1">
        <h6 className="mb-0">{shipment.code}</h6>
        <StatusBadge uiState={uiState} status={shipment.status} />
      </div>
      <div className="small text-muted mb-1">{routeLabel}</div>
      {profileLink ? <div className="small mb-1">{profileLink}</div> : null}
      <div className="small text-muted mt-1">
        {t('pages.tracking.expectedDelivery', { eta })} · {t('pages.tracking.lastUpdate', { time: lastUpdate })}
      </div>
    </Card>
  );
};

export default ShipmentCard;
