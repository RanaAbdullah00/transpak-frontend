import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import CitySelect from '../ui/CitySearchSelect.jsx';
import VehicleTypeDropdown from '../loadboard/VehicleTypeDropdown.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { emitRealtimeRefresh } from '../../utils/realtimeRefresh.js';
import { isKnownCity } from '../../data/pakistanCities.js';
import { kgToTons, ratePerKgToTon, ratePerTonToKg, tonsToKg } from '../../utils/weightUnits.js';
import AvailabilitySlotPicker, { normalizeSlotList } from './AvailabilitySlotPicker.jsx';

const EditCarrierSpaceModal = ({ listing, open, onClose, onSaved }) => {
  const { t } = useLanguage();
  const { request } = useApi();
  const [form, setForm] = useState({
    origin: '',
    destination: '',
    truckCapacityTons: '',
    remainingSpaceTons: '',
    vehicleType: 'Truck',
    ratePerTon: '',
    notes: ''
  });
  const [availabilitySlots, setAvailabilitySlots] = useState([{ start: '08:00', end: '12:00' }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!listing || !open) return;
    setForm({
      origin: listing.origin || '',
      destination: listing.destination || '',
      truckCapacityTons: String(kgToTons(listing.truckCapacityKg ?? 0) || ''),
      remainingSpaceTons: String(kgToTons(listing.remainingSpaceKg ?? 0) || ''),
      vehicleType: listing.vehicleType || 'Truck',
      ratePerTon: listing.ratePerKg != null ? String(ratePerKgToTon(listing.ratePerKg)) : '',
      availableFrom: listing.availableFrom ? String(listing.availableFrom).slice(0, 10) : '',
      notes: listing.notes || ''
    });
    setAvailabilitySlots(
      normalizeSlotList(listing.availabilitySlots).length
        ? normalizeSlotList(listing.availabilitySlots)
        : [{ start: '08:00', end: '12:00' }]
    );
  }, [listing, open]);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!listing?.id) return;
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
      await request({
        method: 'PATCH',
        url: `/carrier-space/${listing.id}`,
        data: {
          origin: form.origin.trim(),
          destination: form.destination.trim(),
          truckCapacityKg: tonsToKg(truckCapacityTons),
          remainingSpaceKg: tonsToKg(remainingSpaceTons),
          vehicleType: form.vehicleType,
          ratePerKg: form.ratePerTon ? ratePerTonToKg(Number(form.ratePerTon)) : null,
          availableFrom: form.availableFrom || null,
          availabilitySlots: normalizeSlotList(availabilitySlots),
          notes: form.notes.trim() || null
        }
      });
      notifySuccess(t('loadsHub.spaceUpdated'));
      emitRealtimeRefresh('loads');
      onSaved?.();
      onClose?.();
    } catch (err) {
      notifyError(formatUserError(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('loadsHub.editListing')} size="lg">
      <form onSubmit={submit} className="d-flex flex-column gap-3">
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label small">{t('pages.postLoadForm.origin')}</label>
            <CitySelect name="origin" value={form.origin} onChange={onChange} required />
          </div>
          <div className="col-md-6">
            <label className="form-label small">{t('pages.postLoadForm.destination')}</label>
            <CitySelect name="destination" value={form.destination} onChange={onChange} required />
          </div>
        </div>
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label small">{t('loadsHub.totalCapacityKg')}</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              name="truckCapacityTons"
              className="form-control"
              value={form.truckCapacityTons}
              onChange={onChange}
              required
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small">{t('loadsHub.remainingKgLabel')}</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              name="remainingSpaceTons"
              className="form-control"
              value={form.remainingSpaceTons}
              onChange={onChange}
              required
            />
          </div>
        </div>
        <div>
          <label className="form-label small">{t('pages.postLoadForm.vehicleType')}</label>
          <VehicleTypeDropdown value={form.vehicleType} onChange={(v) => setForm((p) => ({ ...p, vehicleType: v }))} />
        </div>
        <div>
          <label className="form-label small">{t('loadsHub.availableFrom')}</label>
          <input
            type="date"
            name="availableFrom"
            className="form-control"
            value={form.availableFrom}
            onChange={onChange}
          />
        </div>
        <AvailabilitySlotPicker slots={availabilitySlots} onChange={setAvailabilitySlots} />
        <div>
          <label className="form-label small">{t('loadsHub.ratePerKgLabel')}</label>
          <input
            type="number"
            min="0"
            step="1"
            name="ratePerTon"
            className="form-control"
            value={form.ratePerTon}
            onChange={onChange}
          />
        </div>
        <div>
          <label className="form-label small">{t('loadsHub.notes')}</label>
          <textarea name="notes" className="form-control" rows={2} value={form.notes} onChange={onChange} />
        </div>
        <div className="d-flex gap-2 justify-content-end">
          <Button type="button" variant="outline-secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditCarrierSpaceModal;
