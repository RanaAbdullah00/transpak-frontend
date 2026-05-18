import React, { useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const CarrierLoadActions = ({ load, onAccept, onCounter, onReject, busy = false, disabled = false }) => {
  const { t } = useLanguage();
  const [showCounter, setShowCounter] = useState(false);
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const actionLock = useRef(false);
  const counterLock = useRef(false);

  const listed = Number(load?.expectedPrice ?? 0);
  const locked = busy || disabled || pending;

  const runLocked = async (fn, { counter = false } = {}) => {
    const lockRef = counter ? counterLock : actionLock;
    if (lockRef.current || busy || disabled || pending) return;
    lockRef.current = true;
    setPending(true);
    try {
      await fn();
    } finally {
      lockRef.current = false;
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

  const handleCounter = () =>
    runLocked(
      async () => {
        const val = Number(amount);
        if (!Number.isFinite(val) || val <= 0) return;
        await onCounter?.(load, val);
        setShowCounter(false);
        setAmount('');
      },
      { counter: true }
    );

  return (
    <div className="tp-carrier-load-actions d-flex flex-column gap-2 mt-auto">
      <div className="row g-2">
        <div className="col-4">
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
        <div className="col-4">
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
        <div className="col-4">
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
