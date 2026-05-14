import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PostLoadForm from '../../components/loadboard/PostLoadForm.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';

// Shipper: edit an open load (PATCH /loads/:id).
const EditLoad = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { request } = useApi();
  const [loadRaw, setLoadRaw] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const row = await request({ url: `/loads/${id}` });
        if (!cancelled) setLoadRaw(row);
      } catch (err) {
        if (!cancelled) {
          notifyError(formatUserError(err, t, { fallback: t('pages.loads.failedLoadDetail') }));
          setLoadRaw(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, request, t]);

  const uid = user?.id || user?._id;
  const initialValues = useMemo(() => {
    if (!loadRaw) return null;
    return {
      cargo: String(loadRaw.cargo || '').trim(),
      origin: String(loadRaw.origin || '').trim(),
      destination: String(loadRaw.destination || '').trim(),
      weight: loadRaw.weight != null ? String(loadRaw.weight) : '',
      vehicleType: String(loadRaw.vehicleType || 'Truck').trim(),
      expectedPrice: loadRaw.expectedPrice != null ? String(loadRaw.expectedPrice) : '',
      pickupDate: String(loadRaw.pickupDate || '').trim(),
      deadlineHours: String(loadRaw.deadlineHours != null ? loadRaw.deadlineHours : 2)
    };
  }, [loadRaw]);

  const handleSubmit = async (payload) => {
    try {
      await request({
        method: 'PATCH',
        url: `/loads/${id}`,
        data: {
          cargo: payload.cargo,
          origin: payload.origin,
          destination: payload.destination,
          weight: Number(payload.weight),
          vehicleType: payload.vehicleType,
          expectedPrice: Number(payload.expectedPrice),
          pickupDate: payload.pickupDate,
          deadlineHours: Number(payload.deadlineHours || 2)
        }
      });
      notifySuccess(t('pages.loads.loadUpdated'));
      navigate(`/loads/${id}`);
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.loads.failedUpdateLoad') }));
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <Loader />
      </div>
    );
  }

  if (!loadRaw || !initialValues) {
    return (
      <div className="container py-3">
        <p className="text-muted mb-0">{t('pages.loads.failedLoadDetail')}</p>
      </div>
    );
  }

  if (String(loadRaw.shipperId) !== String(uid)) {
    return (
      <div className="container py-3">
        <p className="text-muted mb-0">{t('errors.generic')}</p>
      </div>
    );
  }

  if (loadRaw.status !== 'open') {
    return (
      <div className="container py-3">
        <p className="text-muted mb-2">{t('pages.loads.onlyOpenEdit')}</p>
        <button type="button" className="btn btn-primary btn-sm rounded-lg" onClick={() => navigate(`/loads/${id}`)}>
          {t('pages.loads.loadDetails')}
        </button>
      </div>
    );
  }

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('pages.loads.editLoadTitle')}</h5>
      <PostLoadForm initialValues={initialValues} onSubmit={handleSubmit} submitLabel={t('pages.loads.saveChanges')} />
    </div>
  );
};

export default EditLoad;
