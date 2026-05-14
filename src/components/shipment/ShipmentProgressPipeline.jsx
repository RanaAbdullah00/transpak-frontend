import React, { useMemo } from 'react';
import Card from '../ui/Card.jsx';
import { normalizeShipmentStatus, SHIPMENT_ORDER } from '../../utils/shipmentStatus.js';

const DEFAULT_LABELS = ['Posted', 'Booked', 'Picked up', 'In transit', 'Delivered', 'Closed'];

function stepIndexFromStatus(status) {
  const c = normalizeShipmentStatus(status) || 'posted';
  const i = SHIPMENT_ORDER.indexOf(c);
  return i >= 0 ? i : 0;
}

// Visual pipeline synced with backend canonical shipment states.
const ShipmentProgressPipeline = ({ status, labels = DEFAULT_LABELS }) => {
  const activeIndex = useMemo(() => stepIndexFromStatus(status), [status]);

  return (
    <Card className="tp-pipeline-card mb-3">
      <div className="small text-muted text-uppercase mb-2">Shipment progress</div>
      <div className="tp-pipeline">
        {labels.map((label, i) => {
          const done = i < activeIndex;
          const current = i === activeIndex;
          return (
            <div key={label} className={`tp-pipeline-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
              <div className="tp-pipeline-node-wrap">
                <div className="tp-pipeline-node">{done ? '✓' : i + 1}</div>
                {i < labels.length - 1 && <div className="tp-pipeline-bar" aria-hidden />}
              </div>
              <div className="tp-pipeline-label small fw-semibold">{label}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default ShipmentProgressPipeline;
