import React, { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import { notifyError } from '../ui/ToastProvider.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const defaultForm = () => ({
  cargo: '',
  origin: '',
  destination: '',
  weight: '',
  vehicleType: 'Truck',
  expectedPrice: '',
  pickupDate: '',
  deadlineHours: '2'
});

// Form used by shippers to post or edit a load.
const PostLoadForm = ({ onSubmit, initialValues = null, submitLabel = null }) => {
  const { t } = useLanguage();
  const primaryCta = submitLabel ?? t('pages.postLoadForm.submitPost');
  const [form, setForm] = useState(() => ({
    ...defaultForm(),
    ...(initialValues || {})
  }));

  useEffect(() => {
    if (initialValues && typeof initialValues === 'object') {
      setForm({ ...defaultForm(), ...initialValues });
    }
  }, [initialValues]);

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
    onSubmit?.(form);
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

  const vType = (code) => {
    if (code === 'Truck') return t('pages.truckForm.typeTruck');
    if (code === 'Trailer') return t('pages.truckForm.typeTrailer');
    if (code === 'Container') return t('pages.truckForm.typeContainer');
    if (code === 'Flatbed') return t('pages.truckForm.typeFlatbed');
    return code;
  };

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
          <label className="form-label small">{t('pages.postLoadForm.pickupCity')}</label>
          <input
            name="origin"
            className="form-control form-control-sm rounded-3"
            placeholder={t('pages.postLoadForm.pickupPlaceholder')}
            value={form.origin}
            onChange={handleChange}
            required
          />
        </div>
        <div className="col-6">
          <label className="form-label small">{t('pages.postLoadForm.dropoffCity')}</label>
          <input
            name="destination"
            className="form-control form-control-sm rounded-3"
            placeholder={t('pages.postLoadForm.dropoffPlaceholder')}
            value={form.destination}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      <div className="row g-2 mt-1">
        <div className="col-6">
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
        <div className="col-6">
          <label className="form-label small">{t('pages.postLoadForm.vehicleType')}</label>
          <select
            name="vehicleType"
            className="form-select form-select-sm rounded-3"
            value={form.vehicleType}
            onChange={handleChange}
          >
            <option value="Truck">{vType('Truck')}</option>
            <option value="Trailer">{vType('Trailer')}</option>
            <option value="Container">{vType('Container')}</option>
            <option value="Flatbed">{vType('Flatbed')}</option>
          </select>
        </div>
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
        <div className="col-6">
          <label className="form-label small">{t('pages.postLoadForm.deadlineBidding')}</label>
          <select
            name="deadlineHours"
            className="form-select form-select-sm rounded-3"
            value={form.deadlineHours}
            onChange={handleChange}
            required
          >
            <option value="2">{t('pages.postLoadForm.deadlineOpt2')}</option>
            <option value="4">{t('pages.postLoadForm.deadlineOpt4')}</option>
            <option value="8">{t('pages.postLoadForm.deadlineOpt8')}</option>
            <option value="24">{t('pages.postLoadForm.deadlineOpt24')}</option>
          </select>
        </div>
      </div>
      <Button variant="primary" className="w-100 mt-3 py-2 rounded-lg" type="submit">
        {primaryCta}
      </Button>
    </form>
  );
};

export default PostLoadForm;
