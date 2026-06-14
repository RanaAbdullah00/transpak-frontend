import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import CitySelect from '../../components/ui/CitySearchSelect.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import VehicleTypeDropdown from '../../components/loadboard/VehicleTypeDropdown.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { emitRealtimeRefresh } from '../../utils/realtimeRefresh.js';
import { isKnownCity } from '../../data/pakistanCities.js';
import { ratePerTonToKg, tonsToKg } from '../../utils/weightUnits.js';
import CapacityVisibilityDuration, {
  DEFAULT_VISIBILITY_HOURS,
  DEFAULT_VISIBILITY_MINUTES
} from '../../components/carrier/CapacityVisibilityDuration.jsx';
import { visibilitySlotsPayload } from '../../utils/capacityVisibility.js';

const emptyForm = () => ({
  origin: '',
  destination: '',
  truckCapacityTons: '',
  remainingSpaceTons: '',
  vehicleType: 'Truck',
  ratePerTon: '',
  availableFrom: '',
  notes: ''
});

const PostCarrierSpace = ({ embedded = false }) => {
  const { t } = useLanguage();
  const { request } = useApi();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [visibilityHours, setVisibilityHours] = useState(String(DEFAULT_VISIBILITY_HOURS));
  const [visibilityMinutes, setVisibilityMinutes] = useState(String(DEFAULT_VISIBILITY_MINUTES));
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!isKnownCity(form.origin) || !isKnownCity(form.destination)) {
      notifyError(t('pages.postLoadForm.cityInvalid'));
      return;
    }
    const truckCapacityTons = Number(form.truckCapacityTons);
    const remainingSpaceTons = Number(form.remainingSpaceTons);
    if (!Number.isFinite(truckCapacityTons) || truckCapacityTons < 0.1) {
      notifyError(t('loadsHub.totalCapacityKg'));
      return;
    }
    if (
      !Number.isFinite(remainingSpaceTons) ||
      remainingSpaceTons < 0.1 ||
      remainingSpaceTons > truckCapacityTons
    ) {
      notifyError(t('loadsHub.remainingKgLabel'));
      return;
    }
    setLoading(true);
    try {
      const data = await request({
        method: 'POST',
        url: '/carrier-space',
        data: {
          origin: form.origin.trim(),
          destination: form.destination.trim(),
          truckCapacityKg: tonsToKg(truckCapacityTons),
          remainingSpaceKg: tonsToKg(remainingSpaceTons),
          vehicleType: form.vehicleType,
          ratePerKg: form.ratePerTon ? ratePerTonToKg(Number(form.ratePerTon)) : null,
          availableFrom: form.availableFrom || null,
          availabilitySlots: visibilitySlotsPayload(visibilityHours, visibilityMinutes),
          notes: form.notes.trim() || null
        },
        skipGlobalErrorToast: true
      });
      if (!data?.id) {
        throw new Error(t('loadsHub.spaceListFailed'));
      }
      notifySuccess(t('loadsHub.spaceListed'));
      setForm(emptyForm());
      setVisibilityHours(String(DEFAULT_VISIBILITY_HOURS));
      setVisibilityMinutes(String(DEFAULT_VISIBILITY_MINUTES));
      emitRealtimeRefresh('loads');
      if (!embedded) {
        navigate('/loads/manage?tab=my-listings', { replace: true });
      }
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('loadsHub.spaceListFailed') }));
    } finally {
      setLoading(false);
    }
  };

  const formBody = (
    <Card className="p-3">
      <form onSubmit={submit}>
        <div className="row g-2">
          <div className="col-md-6">
            <CitySelect
              name="origin"
              label={t('pages.postLoadForm.pickupCity')}
              value={form.origin}
              onChange={onChange}
              required
            />
          </div>
          <div className="col-md-6">
            <CitySelect
              name="destination"
              label={t('pages.postLoadForm.dropoffCity')}
              value={form.destination}
              onChange={onChange}
              required
            />
          </div>
        </div>
        <div className="row g-2 mt-1">
          <div className="col-md-6">
            <label className="form-label small">{t('loadsHub.totalCapacityKg')}</label>
            <input
              type="number"
              name="truckCapacityTons"
              className="form-control form-control-sm rounded-3"
              min="0.1"
              step="0.1"
              value={form.truckCapacityTons}
              onChange={onChange}
              required
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small">{t('loadsHub.remainingKgLabel')}</label>
            <input
              type="number"
              name="remainingSpaceTons"
              className="form-control form-control-sm rounded-3"
              min="0.1"
              step="0.1"
              value={form.remainingSpaceTons}
              onChange={onChange}
              required
            />
          </div>
        </div>
        <div className="row g-2 mt-1">
          <div className="col-md-6">
            <label className="form-label small">{t('pages.postLoadForm.vehicleType')}</label>
            <VehicleTypeDropdown name="vehicleType" value={form.vehicleType} onChange={onChange} />
          </div>
          <div className="col-md-6">
            <label className="form-label small">{t('loadsHub.ratePerKgLabel')}</label>
            <input
              type="number"
              name="ratePerTon"
              className="form-control form-control-sm rounded-3"
              min="0"
              step="1"
              value={form.ratePerTon}
              onChange={onChange}
            />
          </div>
        </div>
        <div className="row g-2 mt-1">
          <div className="col-md-6">
            <label className="form-label small">{t('loadsHub.availableFrom')}</label>
            <input
              type="date"
              name="availableFrom"
              className="form-control form-control-sm rounded-3"
              value={form.availableFrom}
              onChange={onChange}
            />
          </div>
        </div>
        <CapacityVisibilityDuration
          hours={visibilityHours}
          minutes={visibilityMinutes}
          onChange={({ hours, minutes }) => {
            setVisibilityHours(hours);
            setVisibilityMinutes(minutes);
          }}
        />
        <div className="mt-2">
          <label className="form-label small">{t('loadsHub.notes')}</label>
          <textarea
            name="notes"
            className="form-control form-control-sm rounded-3"
            rows={2}
            value={form.notes}
            onChange={onChange}
          />
        </div>
        <Button variant="primary" type="submit" className="w-100 mt-3" disabled={loading}>
          {loading ? t('common.saving') : t('loadsHub.publishCapacity')}
        </Button>
      </form>
    </Card>
  );

  if (embedded) {
    return formBody;
  }

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('loadsHub.postCapacityTitle')}</h5>
      {formBody}
    </div>
  );
};

export default PostCarrierSpace;
