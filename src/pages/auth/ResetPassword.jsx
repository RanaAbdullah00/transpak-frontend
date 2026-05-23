import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import BrandLogo from '../../components/layout/BrandLogo.jsx';
import AuthHeaderActions from '../../components/auth/AuthHeaderActions.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useAuthViewportLock } from '../../hooks/useAuthViewportLock.js';
import { resetPasswordWithOtpApi, fetchProfileApi } from '../../services/authService.js';
import { safeUnwrapAuthResponse, blockNativeFormSubmit, safeDashboardPath } from '../../utils/authApiSafe.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { notifyAuthError } from '../../utils/notifySystem.js';
import PasswordField from '../../components/ui/PasswordField.jsx';
import { getDeliveryHint } from '../../utils/otpDelivery.js';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isUrdu } = useLanguage();
  const { login } = useAuth();
  useAuthViewportLock();

  const email = useMemo(() => String(location.state?.email || '').trim().toLowerCase(), [location.state]);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const deliveryHint = useMemo(
    () =>
      location.state?.emailDelivered === false
        ? getDeliveryHint(location.state, '')
        : location.state?.deliveryHint || null,
    [location.state]
  );

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password', { replace: true });
    }
  }, [email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const c = code.replace(/\D/g, '').slice(0, 6);
    if (password !== confirmPassword) {
      notifyError(t('errors.passwordsDoNotMatch'));
      return;
    }
    if (password.length < 8) {
      notifyError(t('errors.passwordTooShort'));
      return;
    }
    if (c.length !== 6) {
      notifyError(t('errors.generic'));
      return;
    }
    setLoading(true);
    try {
      const res = await resetPasswordWithOtpApi({
        email,
        code: c,
        password,
        confirmPassword
      });
      const payload = safeUnwrapAuthResponse(res);
      const { token, user, currentRole } = payload;
      if (token) localStorage.setItem('transpak_token', token);
      let session = payload;
      try {
        const profRes = await fetchProfileApi();
        const prof = safeUnwrapAuthResponse(profRes);
        if (prof?.user) session = prof;
      } catch {
        /* use reset payload */
      }
      if (session?.user) login(session);
      notifySuccess(t('auth.welcomeBack'));
      const role = session?.user?.activeRole ?? currentRole ?? user?.activeRole ?? user?.roles?.[0];
      navigate(safeDashboardPath(role), { replace: true });
    } catch (err) {
      notifyAuthError(err, t, 'otp');
    } finally {
      setLoading(false);
    }
  };

  if (!email) return null;

  return (
    <div className={`tp-auth-v2 tp-auth-v2--locked position-relative ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="tp-auth-v2__bg" aria-hidden="true">
        <div className="tp-auth-v2__veil" />
        <div className="tp-auth-v2__accent-slab" />
        <div className="tp-auth-v2__grid" />
        <div className="tp-auth-v2__route-line tp-auth-v2__route-line--1" />
        <div className="tp-auth-v2__route-line tp-auth-v2__route-line--2" />
      </div>
      <header className="tp-auth-v2__top tp-auth-v2__top--bar d-flex align-items-center justify-content-between w-100 px-3 z-3">
        <BrandLogo variant="auth" title="TransPak" className="tp-auth-v2__header-brand flex-shrink-0" />
        <AuthHeaderActions />
      </header>
      <div className="tp-auth-v2__body">
        <div className="tp-auth-v2__glass rounded-4 shadow-lg border">
          <div className="tp-auth-v2__glass-content tp-auth-v2__glass-content--register">
            <h1 className="h5 fw-bold mb-2 text-body tp-auth-v2__title">{t('auth.resetPasswordTitle')}</h1>
            <p className="small text-muted mb-2">{t('auth.resetPasswordSubtitle')}</p>
            <p className="small text-body-secondary mb-3">
              <strong className="text-body">{email}</strong>
            </p>
            {deliveryHint ? (
              <p
                className="small text-warning-emphasis mb-3 border-start border-warning border-3 ps-2"
                role="status"
              >
                {deliveryHint}
              </p>
            ) : null}
            <form action="#" method="post" noValidate onSubmit={handleSubmit} className="tp-auth-register-form">
              <div className="mb-2">
                <label className="form-label small">{t('auth.otpCodeLabel')}</label>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={`form-control form-control-sm rounded-3 text-center tp-otp-code-field ${isUrdu ? 'text-end' : ''}`}
                  placeholder={t('auth.otpPlaceholder')}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
              </div>
              <div className="mb-2">
                <label className="form-label small">{t('auth.newPassword')}</label>
                <PasswordField
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  isUrdu={isUrdu}
                  autoComplete="new-password"
                />
              </div>
              <div className="mb-3">
                <label className="form-label small">{t('auth.confirmPassword')}</label>
                <PasswordField
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.reenterPasswordPlaceholder')}
                  isUrdu={isUrdu}
                  autoComplete="new-password"
                />
              </div>
              <Button
                variant="primary"
                className="w-100 py-2 d-flex justify-content-center align-items-center rounded-lg"
                type="submit"
                disabled={loading || password !== confirmPassword || password.length < 8 || code.replace(/\D/g, '').length !== 6}
              >
                {loading ? <Loader light /> : t('auth.updatePasswordButton')}
              </Button>
            </form>
            <p className="small text-center mt-3 mb-0 text-muted tp-auth-v2__footer-line">
              <Link to="/login">{t('auth.backToLogin')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
