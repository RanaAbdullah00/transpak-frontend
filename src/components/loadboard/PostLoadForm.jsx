import React, { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import CitySelect from '../ui/CitySearchSelect.jsx';
import Map from '../Map.jsx';
import { routeFromCityNames } from '../../utils/mapCoords.js';
import { useMapRoute } from '../../hooks/useMapRoute.js';
import VehicleTypeSelect from './VehicleTypeSelect.jsx';
import { notifyError } from '../ui/ToastProvider.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useFareEstimate } from '../../hooks/useFareEstimate.js';
import { isKnownCity } from '../../data/pakistanCities.js';

const defaultForm = () => ({
  cargo: '',
  origin: '',
  destination: '',
  weight: '',
  vehicleType: 'Truck',
  expectedPrice: '',
  pickupDate: '',
  deadlineValue: '6',
  deadlineUnit: 'hours'
});

const PostLoadForm = ({ onSubmit, initialValues = null, submitLabel = null, submitting = false }) => {
  const { t } = useLanguage();
  const primaryCta = submitLabel ?? t('pages.postLoadForm.submitPost');
  const [form, setForm] = useState(() => ({
    ...defaultForm(),
    ...(initialValues || {})
  }));

  const { estimate, loading: fareLoading, usedLocalFallback } = useFareEstimate({
    origin: form.origin,
    destination: form.destination,
    vehicleType: form.vehicleType,
    enabled: !initialValues
  });

  const minFare = Number(estimate?.minimumFare ?? estimate?.suggestedFare ?? 0);
  const enteredPrice = Number(form.expectedPrice) || 0;
  const showFareEstimate = isKnownCity(form.origin) && isKnownCity(form.destination) && !initialValues;
  const fareTooLow = minFare > 0 && enteredPrice > 0 && enteredPrice + 0.01 < minFare;
  const submitDisabled = submitting || fareTooLow;
  const {
    coordinates: orsRoute,
    loading: routeLoading,
    error: routeError,
    usedFallback: routeFallback
  } = useMapRoute({
    origin: form.origin,
    destination: form.destination,
    enabled: showFareEstimate
  });
  const straightRoute = showFareEstimate ? routeFromCityNames(form.origin, form.destination) : [];
  const routePreview = orsRoute.length >= 2 ? orsRoute : straightRoute;

  useEffect(() => {
    if (initialValues && typeof initialValues === 'object') {
      setForm({ ...defaultForm(), ...initialValues });
    }
  }, [initialValues]);

  useEffect(() => {
    if (!initialValues && estimate?.suggestedFare != null && !form.expectedPrice) {
      setForm((p) => ({ ...p, expectedPrice: String(Math.round(estimate.suggestedFare)) }));
    }
  }, [estimate?.suggestedFare, initialValues, form.expectedPrice]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pickup = String(form.pickupDate || '').trim();
    const today = new Date();
    const todayStr = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
      .toISOString()
      .slice(0, 10);
    if (pickup && pickup <= todayStr) {
      notifyError(t('pages.postLoadForm.pickupFutureError'));
      return;
    }
    if (!isKnownCity(form.origin) || !isKnownCity(form.destination)) {
      notifyError(t('pages.postLoadForm.cityInvalid'));
      return;
    }
    const weight = Number(form.weight);
    if (!Number.isFinite(weight) || weight < 0.1 || weight > 80) {
      notifyError(t('pages.postLoadForm.weightInvalid'));
      return;
    }
    const price = Number(form.expectedPrice);
    if (!Number.isFinite(price) || price < 1) {
      notifyError(t('pages.postLoadForm.priceRequired'));
      return;
    }
    const val = Number(form.deadlineValue);
    const unit = form.deadlineUnit === 'minutes' ? 'minutes' : 'hours';
    const deadlineMinutes = unit === 'minutes' ? val : val * 60;
    if (!Number.isFinite(val) || val < 1) {
      notifyError(t('pages.postLoadForm.deadlineInvalid'));
      return;
    }
    if (deadlineMinutes < 15 || deadlineMinutes > 72 * 60) {
      notifyError(t('pages.postLoadForm.deadlineInvalid'));
      return;
    }
    if (minFare > 0 && price + 0.01 < minFare) {
      notifyError(t('pages.postLoadForm.fareBelowMinimum', { fare: Math.ceil(minFare).toLocaleString() }));
      return;
    }
    try {
      await Promise.resolve(
        onSubmit?.({
          ...form,
          deadlineMinutes,
          deadlineHours: Math.ceil(deadlineMinutes / 60),
          distanceKm: estimate?.distanceKm,
          suggestedFare: estimate?.suggestedFare
        })
      );
    } catch {
      /* parent surfaces toast + dev log */
    }
  };

  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const minPickupDate =
    initialValues?.pickupDate && String(initialValues.pickupDate) < tomorrow
      ? String(initialValues.pickupDate)
      : tomorrow;

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-2">
        <label className="form-label small">{t('pages.postLoadForm.cargoDescription')}</label>
        <input
          name="cargo"
          className="form-control form-control-sm rounded-3"
          placeholder={t('pages.postLoadForm.cargoPlaceholder')}
          value={form.cargo}
          onChange={handleChange}
          required
        />
      </div>
      <div className="row g-2">
        <div className="col-6">
          <CitySelect
            name="origin"
            label={t('pages.postLoadForm.pickupCity')}
            value={form.origin}
            onChange={handleChange}
            required
          />
        </div>
        <div className="col-6">
          <CitySelect
            name="destination"
            label={t('pages.postLoadForm.dropoffCity')}
            value={form.destination}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      {showFareEstimate ? (
        <div className="tp-route-summary mt-2 mb-2 p-3 rounded-3" role="status">
          {fareLoading && !estimate ? (
            <p className="mb-0 small text-muted">{t('pages.postLoadForm.fareCalculating')}</p>
          ) : estimate ? (
            <div className="row g-2 small">
              <div className="col-4">
                <div className="text-muted text-uppercase tp-route-summary__label">
                  {t('pages.postLoadForm.summaryDistance')}
                </div>
                <div className="fw-semibold">{estimate.distanceKm} km</div>
              </div>
              <div className="col-4">
                <div className="text-muted text-uppercase tp-route-summary__label">
                  {t('pages.postLoadForm.summaryFare')}
                </div>
                <div className="fw-semibold text-success">
                  PKR {Number(minFare || 0).toLocaleString()}
                </div>
              </div>
              <div className="col-4">
                <div className="text-muted text-uppercase tp-route-summary__label">
                  {t('pages.postLoadForm.summaryEta')}
                </div>
                <div className="fw-semibold">
                  {estimate.estimatedTravelHours != null
                    ? t('pages.postLoadForm.summaryEtaValue', {
                        hours: estimate.estimatedTravelHours,
                        minutes:
                          estimate.estimatedTravelMinutes ??
                          Math.round(estimate.estimatedTravelHours * 60)
                      })
                    : '—'}
                </div>
              </div>
            </div>
          ) : null}
          {usedLocalFallback ? (
            <p className="mb-0 small text-muted mt-2">{t('pages.postLoadForm.fareLocalHint')}</p>
          ) : null}
          {fareTooLow ? (
            <p className="mb-0 small text-danger mt-2">
              {t('pages.postLoadForm.fareBelowMinimum', { fare: Math.ceil(minFare).toLocaleString() })}
            </p>
          ) : null}
        </div>
      ) : null}
      {routePreview.length >= 2 ? (
        <div className="tp-dashboard-map-preview mb-2">
          <label className="form-label small text-muted mb-1">{t('pages.postLoadForm.routeMapLabel')}</label>
          <Map
            pickup={routePreview[0]}
            delivery={routePreview[routePreview.length - 1]}
            route={routePreview}
            height={200}
            loading={routeLoading}
            errorMessage={
              routeFallback && !routeLoading ? t('map.routeFallback') : routeError ? t('map.routeError') : ''
            }
            pickupLabel={t('pages.postLoadForm.pickupCity')}
            deliveryLabel={t('pages.postLoadForm.dropoffCity')}
          />
        </div>
      ) : null}
      <div className="row g-2 mt-1">
        <div className="col-12">
          <label className="form-label small">{t('pages.postLoadForm.weightTons')}</label>
          <input
            type="number"
            name="weight"
            className="form-control form-control-sm rounded-3"
            placeholder={t('pages.postLoadForm.weightPlaceholder')}
            value={form.weight}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      <div className="mt-2">
        <VehicleTypeSelect name="vehicleType" value={form.vehicleType} onChange={handleChange} />
      </div>
      <div className="row g-2 mt-1">
        <div className="col-12">
          <label className="form-label small">{t('pages.postLoadForm.recommendedFareLabel')}</label>
          {showFareEstimate && estimate && minFare > 0 ? (
            <div className="tp-fare-negotiate mb-2">
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>{t('pages.postLoadForm.fareMinLabel')}: PKR {Math.ceil(minFare).toLocaleString()}</span>
                <span>
                  {t('pages.postLoadForm.fareMaxLabel')}: PKR{' '}
                  {Math.ceil(minFare * 1.5).toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                className="form-range"
                min={Math.ceil(minFare)}
                max={Math.ceil(minFare * 1.5)}
                step={500}
                value={enteredPrice || Math.ceil(minFare)}
                onChange={(e) =>
                  setForm((p) => ({ ...p, expectedPrice: String(Math.round(Number(e.target.value))) }))
                }
                aria-label={t('pages.postLoadForm.fareAdjust')}
              />
              <div className="input-group input-group-sm mt-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      expectedPrice: String(Math.max(Math.ceil(minFare), (Number(p.expectedPrice) || 0) - 1000))
                    }))
                  }
                >
                  −
                </button>
                <input
                  type="number"
                  name="expectedPrice"
                  className="form-control rounded-3 text-center"
                  value={form.expectedPrice}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      expectedPrice: String(
                        Math.min(Math.ceil(minFare * 1.5), (Number(p.expectedPrice) || 0) + 1000)
                      )
                    }))
                  }
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <input
              type="number"
              name="expectedPrice"
              className="form-control form-control-sm rounded-3"
              placeholder={t('pages.postLoadForm.pricePlaceholder')}
              value={form.expectedPrice}
              onChange={handleChange}
              required
            />
          )}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small">{t('pages.postLoadForm.pickupDate')}</label>
          <input
            type="date"
            name="pickupDate"
            className="form-control form-control-sm rounded-3"
            value={form.pickupDate}
            onChange={handleChange}
            min={minPickupDate}
            required
          />
        </div>
        <div className="col-12">
          <label className="form-label small">{t('pages.postLoadForm.deadlineBidding')}</label>
          <div className="input-group input-group-sm">
            <input
              type="number"
              name="deadlineValue"
              className="form-control rounded-3"
              min={1}
              max={form.deadlineUnit === 'minutes' ? 4320 : 72}
              step={1}
              value={form.deadlineValue}
              onChange={handleChange}
              required
              aria-describedby="deadlineHelp"
            />
            <select
              name="deadlineUnit"
              className="form-select form-select-sm rounded-3"
              style={{ maxWidth: '7rem' }}
              value={form.deadlineUnit}
              onChange={handleChange}
              aria-label={t('pages.postLoadForm.deadlineUnitAria')}
            >
              <option value="hours">{t('pages.postLoadForm.deadlineHoursUnit')}</option>
              <option value="minutes">{t('pages.postLoadForm.deadlineMinutesUnit')}</option>
            </select>
          </div>
          <div id="deadlineHelp" className="form-text">
            {t('pages.postLoadForm.deadlineHelp')}
          </div>
        </div>
      </div>
      <Button
        variant="primary"
        className="w-100 mt-3 py-2 rounded-lg"
        type="submit"
        disabled={submitDisabled}
      >
        {submitting ? t('common.submitting') : primaryCta}
      </Button>
    </form>
  );
};

export default PostLoadForm;
