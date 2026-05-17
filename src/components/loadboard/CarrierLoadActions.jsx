import React, { useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const CarrierLoadActions = ({ load, onAccept, onCounter, busy = false, disabled = false }) => {
  const { t } = useLanguage();
  const [showCounter, setShowCounter] = useState(false);
  const [amount, setAmount] = useState('');
  const actionLock = useRef(false);

  const listed = Number(load?.expectedPrice ?? 0);
  const locked = busy || disabled;

  const runLocked = async (fn) => {
    if (actionLock.current || busy || disabled) return;
    actionLock.current = true;
    try {
      await fn();
    } finally {
      actionLock.current = false;
    }
  };

  const handleAccept = () =>
    runLocked(async () => {
      await onAccept?.(load);
    });

  const handleCounter = () =>
    runLocked(async () => {
      const val = Number(amount);
      if (!Number.isFinite(val) || val <= 0) return;
      await onCounter?.(load, val);
      setShowCounter(false);
      setAmount('');
    });

  return (
    <div className="tp-carrier-load-actions d-flex flex-column gap-2 mt-auto">
      <div className="row g-2">
        <div className="col-6 col-sm-6">
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
        <div className="col-6 col-sm-6">
          <Button
            variant="outline-primary"
            size="sm"
            className="w-100 rounded-lg tp-touch-target"
            disabled={locked}
            onClick={() => !locked && setShowCounter((v) => !v)}
          >
            {t('pages.loads.carrierSuggestCounter')}
          </Button>
        </div>
      </div>
      {showCounter ? (
        <div className="tp-counter-offer-box rounded-3 p-2">
          <label className="form-label small mb-1">{t('pages.loads.counterAmountLabel')}</label>
          <div className="d-flex flex-column flex-sm-row gap-2">
            <input
              type="number"
              className="form-control form-control-sm"
              min="1"
              step="1000"
              placeholder={listed ? String(listed) : ''}
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button variant="primary" size="sm" className="tp-touch-target flex-shrink-0" disabled={busy} onClick={handleCounter}>
              {busy ? <Loader light size="sm" /> : t('ui.button.submit')}
            </Button>
          </div>
          {listed > 0 ? (
            <small className="text-muted d-block mt-1">
              {t('pages.loads.listedFareHint', { price: listed.toLocaleString() })}
            </small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default CarrierLoadActions;
