import React, { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import CitySelect from '../ui/CitySelect.jsx';
import VehicleTypeSelect from './VehicleTypeSelect.jsx';
import { notifyError } from '../ui/ToastProvider.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useFareEstimate } from '../../hooks/useFareEstimate.js';

const defaultForm = () => ({
  cargo: '',
  origin: '',
  destination: '',
  weight: '',
  vehicleType: 'Truck',
  expectedPrice: '',
  pickupDate: '',
  deadlineHours: '6'
});

const PostLoadForm = ({ onSubmit, initialValues = null, submitLabel = null }) => {
  const { t } = useLanguage();
  const primaryCta = submitLabel ?? t('pages.postLoadForm.submitPost');
  const [form, setForm] = useState(() => ({
    ...defaultForm(),
    ...(initialValues || {})
  }));

  const { estimate, loading: fareLoading } = useFareEstimate({
    origin: form.origin,
    destination: form.destination,
    vehicleType: form.vehicleType,
    enabled: !initialValues
  });

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

  const handleSubmit = (e) => {
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
    const hours = Number(form.deadlineHours);
    if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
      notifyError(t('pages.postLoadForm.deadlineInvalid'));
      return;
    }
    if (minFare > 0 && enteredPrice + 0.01 < minFare) {
      notifyError(t('pages.postLoadForm.fareBelowMinimum', { fare: Math.ceil(minFare).toLocaleString() }));
      return;
    }
    onSubmit?.({
      ...form,
      distanceKm: estimate?.distanceKm,
      suggestedFare: estimate?.suggestedFare
    });
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

  const minFare = Number(estimate?.minimumFare ?? estimate?.suggestedFare ?? 0);
  const enteredPrice = Number(form.expectedPrice) || 0;
  const bothCities = Boolean(form.origin?.trim() && form.destination?.trim());
  const fareTooLow = minFare > 0 && enteredPrice > 0 && enteredPrice + 0.01 < minFare;
  const awaitingFare = bothCities && !initialValues && (fareLoading || !estimate);
  const submitDisabled = awaitingFare || fareTooLow;

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
      {bothCities ? (
        <div className="tp-fare-hint mt-2 mb-0" role="status">
          {fareLoading ? (
            <p className="mb-0">{t('pages.postLoadForm.fareCalculating')}</p>
          ) : estimate ? (
            <>
              <p className="mb-0">
                {t('pages.postLoadForm.fareHint', {
                  km: estimate.distanceKm,
                  fare: Number(minFare || 0).toLocaleString()
                })}
              </p>
              {estimate.fuelCost != null ? (
                <p className="mb-0 small text-muted">
                  {t('pages.postLoadForm.fareFuelHint', {
                    fuel: Number(estimate.fuelCost || 0).toLocaleString()
                  })}
                </p>
              ) : null}
            </>
          ) : null}
          {fareTooLow ? (
            <p className="mb-0 small text-danger mt-1">
              {t('pages.postLoadForm.fareBelowMinimum', { fare: Math.ceil(minFare).toLocaleString() })}
            </p>
          ) : null}
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
        <div className="col-6">
          <label className="form-label small">{t('pages.postLoadForm.expectedPrice')}</label>
          <input
            type="number"
            name="expectedPrice"
            className="form-control form-control-sm rounded-3"
            placeholder={t('pages.postLoadForm.pricePlaceholder')}
            value={form.expectedPrice}
            onChange={handleChange}
            required
          />
        </div>
        <div className="col-6">
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
              name="deadlineHours"
              className="form-control rounded-3"
              min={1}
              max={168}
              step={1}
              value={form.deadlineHours}
              onChange={handleChange}
              required
              aria-describedby="deadlineHelp"
            />
            <span className="input-group-text rounded-3">{t('pages.postLoadForm.deadlineHoursUnit')}</span>
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
        {primaryCta}
      </Button>
    </form>
  );
};

export default PostLoadForm;
