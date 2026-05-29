import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PostLoadForm from '../../components/loadboard/PostLoadForm.jsx';
import Loader from '../../components/ui/Loader.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { AppContext } from '../../context/AppContext.jsx';
import { notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { notifyApiError } from '../../utils/notifySystem.js';
import { logApiSuccess, logApiFailure } from '../../utils/apiDevLog.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { shouldUseAdminShell } from '../../utils/rbac.js';

const PostLoad = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { request, loading } = useApi();
  const { t } = useLanguage();
  const appContext = React.useContext(AppContext);
  const addNotification = appContext?.addNotification || (() => {});

  useEffect(() => {
    if (shouldUseAdminShell(user)) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const profileBlocked = user && user.profileComplete === false && !shouldUseAdminShell(user);
  const [formKey, setFormKey] = React.useState(0);
  const [posting, setPosting] = React.useState(false);

  const handleSubmit = async (payload) => {
    if (posting) return;
    setPosting(true);
    const body = {
      cargo: payload.cargo,
      origin: payload.origin,
      destination: payload.destination,
      weight: Number(payload.weight),
      vehicleType: payload.vehicleType,
      expectedPrice: Number(payload.expectedPrice),
      pickupDate: payload.pickupDate,
      deadlineMinutes: Number(payload.deadlineMinutes || (Number(payload.deadlineHours || 6) * 60)),
      deadlineHours: Number(payload.deadlineHours || 6),
      distanceKm: payload.distanceKm
    };
    try {
      const loadData = await request({
        url: '/loads/create',
        method: 'POST',
        data: body,
        skipGlobalErrorToast: true
      });
      logApiSuccess({ method: 'POST', url: '/loads/create', data: body }, loadData);
      const code = loadData?.code || loadData?.load?.code || `L-${Date.now()}`;
      notifySuccess(t('pages.loads.postLoadSuccess', { code }));
      addNotification({
        type: 'load',
        message: t('pages.loads.postLoadNotify', { code })
      });
      window.dispatchEvent(new CustomEvent('tp:realtime-refresh'));
      setFormKey((k) => k + 1);
      navigate('/loads/manage', { replace: true });
    } catch (error) {
      logApiFailure(error, { method: 'POST', url: '/loads/create', data: body });
      notifyApiError(error);
    } finally {
      setPosting(false);
    }
  };

  if (shouldUseAdminShell(user)) {
    return (
      <div className="container py-5 text-center">
        <Loader />
      </div>
    );
  }

  if (profileBlocked) {
    return (
      <div className="container py-4">
        <div className="alert alert-warning border-0 shadow-sm rounded-3" role="alert">
          <h6 className="alert-heading fw-semibold mb-2">{t('pages.loads.profileRequiredTitle')}</h6>
          <p className="small mb-3">{t('pages.loads.profileRequiredBody')}</p>
          <div className="d-flex flex-wrap gap-2">
            <Link to="/profile">
              <Button variant="primary" className="btn-sm rounded-lg">
                {t('pages.loads.completeProfileCta')}
              </Button>
            </Link>
            <Link to="/dashboard/shipper">
              <Button variant="outline-secondary" className="btn-sm rounded-lg">
                {t('common.dashboard')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('pages.loads.postLoadScreenTitle')}</h5>
      <PostLoadForm
        key={formKey}
        onSubmit={handleSubmit}
        submitLabel={t('pages.loads.postLoadCta')}
        submitting={posting}
      />
    </div>
  );
};

export default PostLoad;
