import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { uploadMediaFile } from '../../services/uploadMedia.js';
import { fleetStatusBadgeClass, isTruckMatchingEligible, normalizeTrucksResponse } from '../../utils/fleetApi.js';
import VehicleTypeDropdown from '../../components/loadboard/VehicleTypeDropdown.jsx';
import SafeImage from '../../components/ui/SafeImage.jsx';
import { syncTrucksAfterCreate } from '../../utils/truckListSync.js';
import { emitRealtimeRefresh } from '../../utils/realtimeRefresh.js';

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

const TruckDetails = () => {
  const { t, isUrdu } = useLanguage();
  const { user } = useAuth();
  const { request } = useApi();
  const [trucks, setTrucks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const editing = useMemo(() => Boolean(form.id), [form.id]);

  const activeRole = user?.activeRole ?? user?.roles?.[0];
  const [profileReady, setProfileReady] = useState(user?.profileComplete === true);
  const isCarrier = activeRole === 'carrier';
  const uploadingImage = uploadingFront || uploadingBack;
  const canSubmit = profileReady && isCarrier && !uploadingImage && !saving;

  useEffect(() => {
    if (user?.profileComplete === true) {
      setProfileReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const u = await request({ method: 'GET', url: '/profile' });
        if (!cancelled) setProfileReady(Boolean(u?.is_profile_complete));
      } catch {
        if (!cancelled) setProfileReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.profileComplete, request]);

  const refresh = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await request({ method: 'GET', url: '/trucks/mine' });
      setTrucks(normalizeTrucksResponse(data));
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.truckDetailsPage.saveFailed') }));
      setTrucks([]);
    } finally {
      setListLoading(false);
    }
  }, [request, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'space') return;
      refresh();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [refresh]);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const uploadCardImage = async (file, field) => {
    const isFront = field === 'truckCardFrontImage';
    if (isFront) setUploadingFront(true);
    else setUploadingBack(true);
    try {
      const url = await uploadMediaFile(file, { retries: 1 });
      setForm((p) => ({ ...p, [field]: url }));
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.truckDetailsPage.uploadFailed') }));
    } finally {
      if (isFront) setUploadingFront(false);
      else setUploadingBack(false);
    }
  };

  const startEdit = (row) => {
    const statusKey = String(row.statusLabel || row.status || '').toUpperCase();
    if (statusKey === 'APPROVED') return;
    setForm({
      id: row.id,
      engineNumber: row.engineNumber || row.truckNumber || '',
      truckType: row.truckType || 'Truck',
      capacity: String(row.capacity ?? ''),
      licensePlate: row.licensePlate || '',
      truckCardFrontImage: row.truckCardFrontImage || row.truckFrontImage || '',
      truckCardBackImage: row.truckCardBackImage || row.truckBackImage || ''
    });
  };

  const reset = () => setForm(emptyForm);

  const setAsDefault = async (row) => {
    try {
      await request({ method: 'PATCH', url: `/trucks/${row.id}/default` });
      notifySuccess(t('pages.truckDetailsPage.defaultSet'));
      await refresh();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.truckDetailsPage.saveFailed') }));
    }
  };

  const removeTruck = async (row) => {
    if (!window.confirm(t('pages.truckDetailsPage.deleteConfirm'))) return;
    try {
      await request({ method: 'DELETE', url: `/trucks/${row.id}` });
      notifySuccess(t('pages.truckDetailsPage.deleted'));
      if (String(form.id) === String(row.id)) reset();
      await refresh();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.truckDetailsPage.saveFailed') }));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      if (!profileReady) notifyError(t('pages.truckDetailsPage.profileRequired'));
      else if (!isCarrier) notifyError(t('pages.truckDetailsPage.carrierRoleRequired'));
      return;
    }
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

    setSaving(true);
    try {
      let saved;
      if (editing) {
        saved = await request({ method: 'PUT', url: `/trucks/${form.id}`, data: payload });
        notifySuccess(t('pages.truckDetailsPage.truckUpdated'));
      } else {
        saved = await request({ method: 'POST', url: '/trucks', data: payload });
        notifySuccess(t('pages.truckDetailsPage.truckAddedSuccess'));
      }
      if (saved?.id) {
        setTrucks((prev) => {
          const idx = prev.findIndex((r) => String(r.id) === String(saved.id));
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...saved };
            return next;
          }
          return [saved, ...prev];
        });
      }
      reset();
      const fetchList = async () => {
        const data = await request({ method: 'GET', url: '/trucks/mine' });
        const list = normalizeTrucksResponse(data);
        setTrucks(list);
        return list;
      };

      if (!editing && saved?.id) {
        await syncTrucksAfterCreate({ saved, fetchList, setTrucks });
      } else {
        await fetchList();
      }
      emitRealtimeRefresh('all');
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.truckDetailsPage.saveFailed') }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`container py-3 tp-truck-page ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3">{t('pages.truckDetailsPage.title')}</h5>

      {!profileReady ? (
        <div className="alert alert-warning small mb-3 d-flex flex-wrap align-items-center gap-2 justify-content-between">
          <span>{t('pages.truckDetailsPage.profileRequired')}</span>
          <Link to="/profile" className="btn btn-warning btn-sm tp-touch-target">
            {t('profile.completeProfileCta')}
          </Link>
        </div>
      ) : null}
      {profileReady && !isCarrier ? (
        <div className="alert alert-info small mb-3">{t('pages.truckDetailsPage.carrierRoleRequired')}</div>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <Card className="p-3 tp-truck-form-card">
            <h6 className="mb-3">{editing ? t('pages.truckDetailsPage.formEdit') : t('pages.truckDetailsPage.formAdd')}</h6>
            <form onSubmit={submit}>
              <div className="mb-2">
                <label className="form-label small fw-semibold">{t('pages.truckDetailsPage.engineLabel')}</label>
                <input
                  name="engineNumber"
                  className="form-control form-control-sm"
                  value={form.engineNumber}
                  onChange={onChange}
                  disabled={!canSubmit}
                  placeholder={t('pages.truckDetailsPage.enginePlaceholder')}
                />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">{t('pages.truckDetailsPage.typeLabel')}</label>
                <VehicleTypeDropdown
                  name="truckType"
                  value={form.truckType}
                  onChange={onChange}
                  disabled={!canSubmit}
                />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">{t('pages.truckDetailsPage.capacityLabel')}</label>
                <input
                  name="capacity"
                  type="number"
                  className="form-control form-control-sm"
                  value={form.capacity}
                  onChange={onChange}
                  min="0"
                  disabled={!canSubmit}
                />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">{t('pages.truckDetailsPage.plateLabel')}</label>
                <input
                  name="licensePlate"
                  className="form-control form-control-sm"
                  value={form.licensePlate}
                  onChange={onChange}
                  disabled={!canSubmit}
                />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">{t('pages.truckDetailsPage.cardFrontLabel')}</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="form-control form-control-sm"
                  disabled={!canSubmit || uploadingImage}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadCardImage(f, 'truckCardFrontImage');
                    e.target.value = '';
                  }}
                />
                {uploadingFront && !form.truckCardFrontImage ? (
                  <div className="mt-2 small text-muted d-flex align-items-center gap-2">
                    <Loader size="sm" /> {t('pages.truckDetailsPage.uploading')}
                  </div>
                ) : null}
                {form.truckCardFrontImage ? (
                  <SafeImage
                    src={form.truckCardFrontImage}
                    alt={t('pages.truckDetailsPage.cardFrontAlt')}
                    className="mt-2 tp-img-contain-full"
                    fallback={
                      <div className="mt-2 small text-muted tp-image-fallback rounded border p-2 text-center">
                        {t('profile.notOnFile')}
                      </div>
                    }
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
                  disabled={!canSubmit || uploadingImage}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadCardImage(f, 'truckCardBackImage');
                    e.target.value = '';
                  }}
                />
                {uploadingBack && !form.truckCardBackImage ? (
                  <div className="mt-2 small text-muted d-flex align-items-center gap-2">
                    <Loader size="sm" /> {t('pages.truckDetailsPage.uploading')}
                  </div>
                ) : null}
                {form.truckCardBackImage ? (
                  <SafeImage
                    src={form.truckCardBackImage}
                    alt={t('pages.truckDetailsPage.cardBackAlt')}
                    className="mt-2 tp-img-contain-full"
                    fallback={
                      <div className="mt-2 small text-muted tp-image-fallback rounded border p-2 text-center">
                        {t('profile.notOnFile')}
                      </div>
                    }
                  />
                ) : null}
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <Button variant="primary" type="submit" className="tp-touch-target d-inline-flex align-items-center gap-2" disabled={!canSubmit}>
                  {saving ? (
                    <>
                      <Loader light size="sm" /> {t('pages.truckDetailsPage.saving')}
                    </>
                  ) : editing ? (
                    t('pages.truckDetailsPage.saveChanges')
                  ) : (
                    t('pages.truckDetailsPage.addTruckCta')
                  )}
                </Button>
                <Button variant="outline-secondary" type="button" className="tp-touch-target" onClick={reset} disabled={saving}>
                  {t('pages.truckDetailsPage.reset')}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="col-12 col-lg-7">
          <Card className="p-3">
            <h6 className="mb-3">{t('pages.truckDetailsPage.myTrucks')}</h6>
            {listLoading && trucks.length === 0 ? (
              <div className="d-flex justify-content-center py-4">
                <Loader />
              </div>
            ) : trucks.length === 0 ? (
              <div className="text-muted small tp-empty-state py-4 text-center">{t('pages.truckDetailsPage.empty')}</div>
            ) : (
              <div className="list-group list-group-flush tp-truck-list">
                {trucks.map((row) => {
                  const thumb = row.truckCardFrontImage || row.truckFrontImage || '';
                  const statusKey = String(row.statusLabel || row.status || '').toUpperCase();
                  const isSuspended = statusKey === 'SUSPENDED';
                  const isApproved = statusKey === 'APPROVED';
                  return (
                    <div key={row.id} className="list-group-item px-0 border-0 border-bottom py-3">
                      <div className="d-flex flex-row align-items-start gap-3">
                        <div
                          className="flex-shrink-0 rounded border overflow-hidden bg-light"
                          style={{ width: 88, height: 66 }}
                        >
                          {thumb ? (
                            <SafeImage
                              src={thumb}
                              alt=""
                              className="w-100 h-100"
                              style={{ objectFit: 'cover' }}
                              fallback={
                                <div className="w-100 h-100 d-flex align-items-center justify-content-center small text-muted">
                                  —
                                </div>
                              }
                            />
                          ) : (
                            <div className="w-100 h-100 d-flex align-items-center justify-content-center small text-muted">
                              —
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-grow-1">
                          <div className="fw-semibold d-flex align-items-center gap-2 flex-wrap">
                            <span className="text-break">{row.engineNumber || row.truckNumber}</span>
                            <span
                              className={`badge ${fleetStatusBadgeClass(row.statusLabel || row.status)}`}
                              style={{ fontSize: 9 }}
                            >
                              {row.statusLabel || row.status || t('pages.fleet.statusPending')}
                            </span>
                            {row.isDefault ? (
                              <span className="badge bg-primary" style={{ fontSize: 9 }}>
                                {t('pages.truckDetailsPage.defaultBadge')}
                              </span>
                            ) : null}
                          </div>
                          <div className="small text-muted text-break mt-1">
                            {row.truckType} · {row.capacity || 0}t · {row.licensePlate}
                          </div>
                          {isSuspended ? (
                            <div className="small text-danger mt-1">{t('pages.truckDetailsPage.suspendedHint')}</div>
                          ) : isTruckMatchingEligible(row) ? (
                            <div className="small text-success mt-1">{t('pages.truckDetailsPage.matchingEligible')}</div>
                          ) : (
                            <div className="small text-warning mt-1">{t('pages.truckDetailsPage.notMatchingEligible')}</div>
                          )}
                        </div>
                        <div className="d-flex flex-column gap-1 flex-shrink-0">
                          {!isApproved ? (
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="tp-touch-target"
                            onClick={() => startEdit(row)}
                          >
                            {t('pages.truckDetailsPage.edit')}
                          </Button>
                          ) : (
                            <span className="small text-muted text-center px-1" title={t('pages.truckDetailsPage.verifiedNoEdit')}>
                              {t('pages.truckDetailsPage.verifiedLocked')}
                            </span>
                          )}
                          {isTruckMatchingEligible(row) && !row.isDefault ? (
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="tp-touch-target"
                              onClick={() => setAsDefault(row)}
                            >
                              {t('pages.truckDetailsPage.setDefault')}
                            </Button>
                          ) : null}
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="tp-touch-target"
                            onClick={() => removeTruck(row)}
                          >
                            {t('pages.truckDetailsPage.delete')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TruckDetails;
