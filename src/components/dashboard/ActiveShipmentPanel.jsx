import React from 'react';
import TrackingMap from '../shipment/TrackingMap.jsx';
import ShipmentProgressBox from '../shipment/ShipmentProgressBox.jsx';
import StatusBadge from '../shipment/StatusBadge.jsx';
import StatusTimeline from '../shipment/StatusTimeline.jsx';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';

/**
 * Single tracking UI for shipper + carrier dashboards (backend tracking only, progress above map).
 */
const ActiveShipmentPanel = ({
  trackingData,
  loadingTracking,
  emptyState,
  carrierAdvance = null
}) => {
  if (loadingTracking) {
    return (
      <div className="text-center py-4">
        <Loader />
      </div>
    );
  }

  if (!trackingData) {
    return emptyState;
  }

  const st = trackingData.tracking?.status;

  return (
    <div className="tp-active-shipment-panel">
      <ShipmentProgressBox status={st} eta={trackingData.tracking?.eta} />
      <div className="mt-3">
        <TrackingMap trackingData={trackingData} />
      </div>
      <div className="mt-3">
        <StatusBadge status={st || 'unknown'} />
      </div>
      {carrierAdvance && (
        <div className="mt-3 pt-2 border-top">
          <h6 className="mb-2">{carrierAdvance.title}</h6>
          <div className="d-grid gap-2" style={{ maxWidth: 320 }}>
            <Button
              variant="primary"
              className="py-2"
              onClick={() => carrierAdvance.upcoming && carrierAdvance.onAdvance(carrierAdvance.upcoming)}
              disabled={!carrierAdvance.upcoming || carrierAdvance.loadingStatus}
            >
              {carrierAdvance.buttonLabel}
            </Button>
          </div>
          <small className="text-muted mt-2 d-block">
            {carrierAdvance.statusLine}
          </small>
        </div>
      )}
      <div className="mt-3">
        {trackingData.history?.length > 0 ? (
          <StatusTimeline
            currentStatus={st}
            events={trackingData.history.map((h) => ({
              label: h.event,
              time: h.time,
              note: h.location,
              done: true
            }))}
          />
        ) : (
          <div className="text-muted small text-center py-3">No history available</div>
        )}
      </div>
    </div>
  );
};

export default ActiveShipmentPanel;
