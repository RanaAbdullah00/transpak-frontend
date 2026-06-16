import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadCard from '../../components/loadboard/LoadCard.jsx';
import TranslatedText from '../../components/ui/TranslatedText.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifySuccess, notifyError, notifyInfo } from '../../components/ui/ToastProvider.jsx';
import { notifyProfileIncomplete, notifySystem, SystemNotifyType } from '../../utils/notifySystem.js';
import { formatUserError } from '../../utils/userErrors.js';
import { emitRealtimeRefresh } from '../../utils/realtimeRefresh.js';
import { useRatingSummaryBatch } from '../../hooks/useRatingSummaryBatch.js';

// Carrier bid placement page. Expects "load" object from AvailableLoads route state.
const PlaceBid = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const load = location.state?.load;
  const { request, loading } = useApi();
  const [submitting, setSubmitting] = useState(false);
  const { ratingMap, loading: ratingsLoading } = useRatingSummaryBatch(
    load?.shipperId ? [load.shipperId] : []
  );

  useEffect(() => {
    const role = user?.activeRole ?? user?.roles?.[0];
    if (role === 'carrier' && !load) {
      notifyInfo(t('pages.loads.carrierUseFreightBoard'));
      navigate('/loads/manage?tab=marketplace&sub=loads', { replace: true });
      return;
    }
    if (user && user.profileComplete === false) {
      notifyProfileIncomplete(t);
      navigate('/profile', { replace: true });
    }
  }, [user, navigate, t, load]);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [transitTime, setTransitTime] = useState(2);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (load?.expectedPrice) {
      setAmount((load.expectedPrice * 0.9).toFixed(0));
    }
  }, [load]);

  if (!load) {
    return (
      <div className="container py-3">
        <h5 className="mb-3 text-muted">{t('pages.placeBid.title')}</h5>
        <Card className="p-4 text-center">
          <p className="small text-muted mb-3">
            {t('pages.placeBid.noLoadBody')}{' '}
            <Link to="/loads">{t('pages.placeBid.availableLoadsLink')}</Link>
            {' · '}
            {t('pages.placeBid.placeBidAction')}
          </p>
          <Button variant="primary" onClick={() => navigate('/loads')}>
            {t('pages.placeBid.browseLoads')}
          </Button>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || loading) return;
    setSubmitting(true);
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? `bid-${crypto.randomUUID()}`
        : `bid-${Date.now()}`;
    try {
      const bid = await request({
        url: '/bids',
        method: 'POST',
        data: {
          loadId: load.id,
          amount: Number(amount)
        },
        headers: { 'Idempotency-Key': idempotencyKey },
        skipGlobalErrorToast: true
      });
      if (!bid?.id && !bid?.loadId) {
        throw new Error(t('pages.placeBid.bidFailed'));
      }

      if (bid?.vehicleTypeMismatchWarning) {
        notifySystem(SystemNotifyType.WARNING, t('pages.loads.vehicleTypeMismatchWarning'));
      }

      notifySuccess(t('pages.placeBid.bidPlaced', { code: load.code }));
      emitRealtimeRefresh('bids');
      navigate('/loads');
    } catch (error) {
      notifyError(formatUserError(error, t, { fallback: t('pages.placeBid.bidFailed') }));
    } finally {
      setSubmitting(false);
    }
  };

  const isValidBid = Number(amount) > 0 && transitTime >= 1;
  const transitLabel =
    transitTime === 1
      ? t('pages.placeBid.transitDay', { n: String(transitTime) })
      : t('pages.placeBid.transitDays', { n: String(transitTime) });

  const truckLine = t('pages.placeBid.truckFallback', {
    reg: user?.truckReg || t('common.emDash'),
    tons: String(user?.truckCapacity ?? load.weight ?? '—')
  });

  return (
    <div className="container py-3">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item">
            <Link to="/loads">{t('pages.placeBid.breadcrumbLoads')}</Link>
          </li>
          <li className="breadcrumb-item active">{t('pages.placeBid.breadcrumbCurrent')}</li>
        </ol>
      </nav>

      <div className="row g-4">
        <div className="col-lg-7">
          <h5 className="mb-3">
            {t('pages.placeBid.bidOn')} <strong>{load.code}</strong>
            <span className="badge bg-info ms-2">
              <TranslatedText text={load.cargo} />
            </span>
          </h5>
          <LoadCard load={load} ratingMap={ratingMap} ratingsLoading={ratingsLoading} />
        </div>

        <div className="col-lg-5">
          <Card className="p-4 h-100">
            <h6 className="mb-3">{t('pages.placeBid.yourDetails')}</h6>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-semibold small">{t('pages.placeBid.amountLabel')}</label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text">PKR</span>
                  <input
                    type="number"
                    className={`form-control form-control-lg ${
                      amount && Number(amount) < load.expectedPrice * 0.85 ? 'border-success' : ''
                    }`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={t('pages.placeBid.amountPlaceholder')}
                    required
                    min="1000"
                  />
                </div>
                <small className="text-muted">
                  {t('pages.placeBid.expectedLine', { price: load.expectedPrice?.toLocaleString() ?? '0' })}
                </small>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">{t('pages.placeBid.transitLabel')}</label>
                  <input
                    type="number"
                    className="form-control form-control-lg"
                    value={transitTime}
                    onChange={(e) => setTransitTime(Number(e.target.value))}
                    min="1"
                    max="7"
                    required
                  />
                  <small className="text-muted">{transitLabel}</small>
                </div>
                <div className="col-md-6">
                  <label className="form-label small">{t('pages.placeBid.currency')}</label>
                  <select
                    className="form-select form-select-lg"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="PKR">PKR</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small">{t('pages.placeBid.yourTruck')}</label>
                  <select className="form-select form-select-lg" disabled>
                    <option>{truckLine}</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold small">{t('pages.placeBid.notesLabel')}</label>
                <textarea
                  className="form-control form-control-lg"
                  rows="3"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('pages.placeBid.notesPlaceholder')}
                  maxLength="500"
                />
                <small className="text-muted">
                  {note.length}/500
                </small>
              </div>

              <Button
                variant="success"
                className="w-100 py-3 fw-bold fs-5 shadow-sm"
                type="submit"
                disabled={!isValidBid || loading || submitting}
              >
                {isValidBid
                  ? t('pages.placeBid.submitCta', {
                      amount: Number(amount).toLocaleString(),
                      currency
                    })
                  : t('pages.placeBid.submitInvalid')}
                <br />
                <small className="fw-normal opacity-75">{t('pages.placeBid.submitSub')}</small>
              </Button>
            </form>

            <div className="mt-4 pt-3 border-top small text-muted text-center">{t('pages.placeBid.footerNote')}</div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PlaceBid;
