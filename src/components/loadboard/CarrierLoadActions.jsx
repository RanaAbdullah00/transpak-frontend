import React, { useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const CarrierLoadActions = ({ load, onAccept, onReject, busy = false, disabled = false }) => {
  const { t } = useLanguage();
  const [pending, setPending] = useState(false);
  const actionLock = useRef(false);

  const listed = Number(load?.expectedPrice ?? 0);
  const locked = busy || disabled || pending;

  const runLocked = async (fn) => {
    if (actionLock.current || busy || disabled || pending) return;
    actionLock.current = true;
    setPending(true);
    try {
      await fn();
    } finally {
      actionLock.current = false;
      setPending(false);
    }
  };

  const handleAccept = () =>
    runLocked(async () => {
      await onAccept?.(load);
    });

  const handleReject = () =>
    runLocked(async () => {
      await onReject?.(load);
    });

  return (
    <div className="tp-carrier-load-actions d-flex flex-column gap-2 mt-auto">
      <div className="row g-2">
        <div className="col-6">
          <Button
            variant="success"
            size="sm"
            className="w-100 rounded-lg tp-btn-glow tp-touch-target"
            disabled={locked || !listed}
            onClick={handleAccept}
          >
            {busy ? <Loader light size="sm" /> : t('pages.loads.carrierAcceptBid')}
          </Button>
        </div>
        <div className="col-6">
          <Button
            variant="outline-danger"
            size="sm"
            className="w-100 rounded-lg tp-touch-target"
            disabled={locked}
            onClick={handleReject}
          >
            {busy ? <Loader light size="sm" /> : t('pages.loads.carrierRejectLoad')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CarrierLoadActions;
