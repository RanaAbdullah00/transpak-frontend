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
import { isKnownCity } from '../../data/pakistanCities.js';

const emptyForm = () => ({
  origin: '',
  destination: '',
  truckCapacityKg: '',
  remainingSpaceKg: '',
  vehicleType: 'Truck',
  ratePerKg: '',
  notes: ''
});

const PostCarrierSpace = ({ embedded = false }) => {
  const { t } = useLanguage();
  const { request } = useApi();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!isKnownCity(form.origin) || !isKnownCity(form.destination)) {
      notifyError(t('pages.postLoadForm.cityInvalid'));
      return;
    }
    const truckCapacityKg = Number(form.truckCapacityKg);
    const remainingSpaceKg = Number(form.remainingSpaceKg);
    if (!Number.isFinite(truckCapacityKg) || truckCapacityKg < 1) {
      notifyError(t('loadsHub.totalCapacityKg'));
      return;
    }
    if (!Number.isFinite(remainingSpaceKg) || remainingSpaceKg < 1 || remainingSpaceKg > truckCapacityKg) {
      notifyError(t('loadsHub.remainingKgLabel'));
      return;
    }
    setLoading(true);
    try {
      await request({
        method: 'POST',
        url: '/carrier-space',
        data: {
          origin: form.origin.trim(),
          destination: form.destination.trim(),
          truckCapacityKg,
          remainingSpaceKg,
          vehicleType: form.vehicleType,
          ratePerKg: form.ratePerKg ? Number(form.ratePerKg) : null,
          notes: form.notes.trim() || null
        }
      });
      notifySuccess(t('loadsHub.spaceListed'));
      setForm(emptyForm());
      window.dispatchEvent(new CustomEvent('tp:realtime-refresh'));
      if (!embedded) {
        navigate('/dashboard/carrier', { replace: true });
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
              name="truckCapacityKg"
              className="form-control form-control-sm rounded-3"
              min="1"
              value={form.truckCapacityKg}
              onChange={onChange}
              required
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small">{t('loadsHub.remainingKgLabel')}</label>
            <input
              type="number"
              name="remainingSpaceKg"
              className="form-control form-control-sm rounded-3"
              min="1"
              value={form.remainingSpaceKg}
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
              name="ratePerKg"
              className="form-control form-control-sm rounded-3"
              min="0"
              value={form.ratePerKg}
              onChange={onChange}
            />
          </div>
        </div>
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
