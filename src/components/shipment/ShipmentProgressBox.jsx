import React, { useMemo } from 'react';
import Card from '../ui/Card.jsx';
import { SHIPMENT_ORDER, normalizeShipmentStatus } from '../../utils/shipmentStatus.js';
import { useLanguage } from '../../hooks/useLanguage.js';

/** Horizontal lifecycle line: labels on the rail; done / current / upcoming. */
const ShipmentProgressBox = ({ status, uiState = null, eta }) => {
  const { t } = useLanguage();
  const cur = uiState?.status || normalizeShipmentStatus(status) || 'posted';
  const idx = Math.max(0, SHIPMENT_ORDER.indexOf(cur));
  const n = SHIPMENT_ORDER.length;
  const fillPct = n <= 1 ? 0 : (idx / (n - 1)) * 100;

  const labelFor = useMemo(
    () => ({
      posted: t('pages.shipmentLifecycle.posted'),
      booked: t('pages.shipmentLifecycle.booked'),
      pickedup: t('pages.shipmentLifecycle.pickedUp'),
      intransit: t('pages.shipmentLifecycle.inTransit'),
      delivered: t('pages.shipmentLifecycle.delivered'),
      closed: t('pages.shipmentLifecycle.closed')
    }),
    [t]
  );

  const stepClass = (i) => {
    if (i < idx) return 'done';
    if (i === idx) return 'current';
    return 'upcoming';
  };

  return (
    <Card className="tp-progress-box mb-0 h-100">
      <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
        <span className="small text-muted text-uppercase fw-semibold">{t('pages.shipmentLifecycle.railTitle')}</span>
        {eta ? <span className="small text-muted">{eta}</span> : null}
      </div>
      <div className="tp-progress-lane px-1">
        <div className="tp-progress-lane__labels d-flex justify-content-between gap-1">
          {SHIPMENT_ORDER.map((step, i) => (
            <div key={step} className="tp-progress-lane__label-cell flex-fill text-center">
              <span className={`tp-progress-lane__label tp-progress-lane__label--${stepClass(i)}`}>
                {labelFor[step] || step}
              </span>
            </div>
          ))}
        </div>
        <div className="tp-progress-lane__bar-row position-relative mx-1 my-2">
          <div className="tp-progress-lane__bar-bg rounded-pill" />
          <div className="tp-progress-lane__bar-fill rounded-pill" style={{ width: `${fillPct}%` }} />
          <div className="tp-progress-lane__nodes d-flex justify-content-between align-items-center position-relative">
            {SHIPMENT_ORDER.map((step, i) => (
              <div
                key={step}
                className={`tp-progress-lane__node tp-progress-lane__node--${stepClass(i)}`}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ShipmentProgressBox;
