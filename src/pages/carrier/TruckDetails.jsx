import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { unwrapErrorMessage } from '../../utils/unwrapApi.js';

const emptyForm = {
  id: null,
  engineNumber: '',
  truckType: 'Truck',
  capacity: '',
  licensePlate: '',
  truckCardFrontImage: '',
  truckCardBackImage: ''
};

const isTruckComplete = (t) =>
  t && (t.engineNumber || t.truckNumber) && (t.truckCardFrontImage || t.truckFrontImage) && (t.truckCardBackImage || t.truckBackImage);

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const TruckDetails = () => {
  const { t, isUrdu } = useLanguage();
  const { request, loading } = useApi();
  const [trucks, setTrucks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const editing = useMemo(() => Boolean(form.id), [form.id]);

  const refresh = useCallback(async () => {
    const data = await request({ method: 'GET', url: '/trucks/mine' });
    setTrucks(Array.isArray(data) ? data : []);
  }, [request]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const startEdit = (t) => {
    setForm({
      id: t.id,
      engineNumber: t.engineNumber || t.truckNumber || '',
      truckType: t.truckType || 'Truck',
      capacity: String(t.capacity ?? ''),
      licensePlate: t.licensePlate || '',
      truckCardFrontImage: t.truckCardFrontImage || t.truckFrontImage || '',
      truckCardBackImage: t.truckCardBackImage || t.truckBackImage || ''
    });
  };

  const reset = () => setForm(emptyForm);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        engineNumber: form.engineNumber.trim(),
        truckType: form.truckType.trim(),
        capacity: Number(form.capacity || 0),
        licensePlate: form.licensePlate.trim(),
        truckCardFrontImage: form.truckCardFrontImage,
        truckCardBackImage: form.truckCardBackImage
      };

      if (!payload.engineNumber || !payload.truckType || !payload.licensePlate || !payload.truckCardFrontImage || !payload.truckCardBackImage) {
        notifyError(t('pages.truckDetailsPage.validationMissing'));
        return;
      }

      if (editing) {
        await request({ method: 'PUT', url: `/trucks/${form.id}`, data: payload });
        notifySuccess(t('pages.truckDetailsPage.truckUpdated'));
      } else {
        await request({ method: 'POST', url: '/trucks', data: payload });
        notifySuccess(t('pages.truckDetailsPage.truckAdded'));
      }
      reset();
      await refresh();
    } catch (err) {
      notifyError(unwrapErrorMessage(err) || t('pages.truckDetailsPage.saveFailed'));
    }
  };

  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3">{t('pages.truckDetailsPage.title')}</h5>

      <div className="row g-3">
        <div className="col-lg-5">
          <Card className="p-3">
            <h6 className="mb-3">{editing ? t('pages.truckDetailsPage.formEdit') : t('pages.truckDetailsPage.formAdd')}</h6>
            <form onSubmit={submit}>
              <div className="mb-2">
                <label className="form-label small fw-semibold">{t('pages.truckDetailsPage.engineLabel')}</label>
                <input
                  name="engineNumber"
                  className="form-control form-control-sm"
                  value={form.engineNumber}
                  onChange={onChange}
                  placeholder={t('pages.truckDetailsPage.enginePlaceholder')}
                />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">{t('pages.truckDetailsPage.typeLabel')}</label>
                <select name="truckType" className="form-select form-select-sm" value={form.truckType} onChange={onChange}>
                  <option>Truck</option>
                  <option>Trailer</option>
                  <option>Container</option>
                  <option>Flatbed</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">{t('pages.truckDetailsPage.capacityLabel')}</label>
                <input name="capacity" type="number" className="form-control form-control-sm" value={form.capacity} onChange={onChange} min="0" />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">{t('pages.truckDetailsPage.plateLabel')}</label>
                <input name="licensePlate" className="form-control form-control-sm" value={form.licensePlate} onChange={onChange} />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">{t('pages.truckDetailsPage.cardFrontLabel')}</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="form-control form-control-sm"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await fileToDataUrl(f);
                    setForm((p) => ({ ...p, truckCardFrontImage: url }));
                  }}
                />
                {form.truckCardFrontImage ? (
                  <img
                    src={form.truckCardFrontImage}
                    alt={t('pages.truckDetailsPage.cardFrontAlt')}
                    className="mt-2"
                    style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--pak-border)' }}
                  />
                ) : null}
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">{t('pages.truckDetailsPage.cardBackLabel')}</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="form-control form-control-sm"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await fileToDataUrl(f);
                    setForm((p) => ({ ...p, truckCardBackImage: url }));
                  }}
                />
                {form.truckCardBackImage ? (
                  <img
                    src={form.truckCardBackImage}
                    alt={t('pages.truckDetailsPage.cardBackAlt')}
                    className="mt-2"
                    style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--pak-border)' }}
                  />
                ) : null}
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? (
                    <Loader light size="sm" />
                  ) : editing ? (
                    t('pages.truckDetailsPage.saveChanges')
                  ) : (
                    t('pages.truckDetailsPage.addTruckCta')
                  )}
                </Button>
                <Button variant="outline-secondary" type="button" onClick={reset}>
                  {t('pages.truckDetailsPage.reset')}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="col-lg-7">
          <Card className="p-3">
            <h6 className="mb-3">{t('pages.truckDetailsPage.myTrucks')}</h6>
            {loading && trucks.length === 0 ? (
              <div className="d-flex justify-content-center py-4">
                <Loader />
              </div>
            ) : trucks.length === 0 ? (
              <div className="text-muted small">{t('pages.truckDetailsPage.empty')}</div>
            ) : (
              <div className="list-group list-group-flush">
                {trucks.map((row) => (
                  <div key={row.id} className="list-group-item px-0">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div className="min-w-0">
                        <div className="fw-semibold d-flex align-items-center gap-2 flex-wrap">
                          <span className="text-break">{row.engineNumber || row.truckNumber}</span>
                          {isTruckComplete(row) ? (
                            <span className="badge bg-success" style={{ fontSize: 9 }} title={t('pages.truckDetailsPage.verifiedShort')}>
                              ✓
                            </span>
                          ) : null}
                        </div>
                        <div className="small text-muted">
                          {row.truckType} · {row.capacity || 0}t · {row.licensePlate}
                        </div>
                      </div>
                      <Button variant="outline-primary" size="sm" className="flex-shrink-0" onClick={() => startEdit(row)}>
                        {t('pages.truckDetailsPage.edit')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TruckDetails;

