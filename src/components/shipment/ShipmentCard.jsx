import React from 'react';
import Card from '../ui/Card.jsx';
import StatusBadge from './StatusBadge.jsx';

const ShipmentCard = ({ shipment, uiState = null, profileLink = null }) => {
  return (
    <Card>
      <div className="d-flex justify-content-between align-items-center mb-1">
        <h6 className="mb-0">{shipment.code}</h6>
        <StatusBadge uiState={uiState} status={shipment.status} />
      </div>
      <div className="small text-muted mb-1">
        {shipment.origin} → {shipment.destination}
      </div>
      {profileLink ? <div className="small mb-1">{profileLink}</div> : null}
      <div className="small text-muted mt-1">
        Expected delivery:{' '}
        {shipment.eta != null && String(shipment.eta).trim() !== '' ? shipment.eta : 'Not set'}. Last update:{' '}
        {shipment.lastUpdate != null && String(shipment.lastUpdate).trim() !== '' ? shipment.lastUpdate : 'Not set'}
      </div>
    </Card>
  );
};

export default ShipmentCard;
