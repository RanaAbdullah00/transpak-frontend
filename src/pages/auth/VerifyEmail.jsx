import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import BrandLogo from '../../components/layout/BrandLogo.jsx';
import AuthHeaderActions from '../../components/auth/AuthHeaderActions.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useAuthViewportLock } from '../../hooks/useAuthViewportLock.js';
import { verifyRegisterOtpApi, resendRegisterOtpApi, fetchProfileApi } from '../../services/authService.js';
import { safeUnwrapAuthResponse, blockNativeFormSubmit, safeDashboardPath } from '../../utils/authApiSafe.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { notifyAuthError } from '../../utils/notifySystem.js';
import { isEmailDelivered, getDeliveryHint } from '../../utils/otpDelivery.js';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isUrdu } = useLanguage();
  const { login } = useAuth();
  useAuthViewportLock();

  const email = useMemo(() => String(location.state?.email || '').trim().toLowerCase(), [location.state]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [deliveryBanner, setDeliveryBanner] = useState(() => ({
    hint: location.state?.deliveryHint || null,
    reason: location.state?.deliveryReason || null,
    showWarning:
      location.state?.emailDelivered === false || Boolean(location.state?.deliveryHint)
  }));

  useEffect(() => {
    setDeliveryBanner({
      hint: location.state?.deliveryHint || null,
      reason: location.state?.deliveryReason || null,
      showWarning:
        location.state?.emailDelivered === false || Boolean(location.state?.deliveryHint)
    });
  }, [location.state]);

  useEffect(() => {
    if (!email) {
      navigate('/register', { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    const c = code.replace(/\D/g, '').slice(0, 6);
    if (c.length !== 6) {
      notifyError(t('errors.generic'));
      return;
    }
    setLoading(true);
    try {
      const res = await verifyRegisterOtpApi({ email, code: c });
      const payload = safeUnwrapAuthResponse(res);
      const { token, user, currentRole } = payload;
      if (token) localStorage.setItem('transpak_token', token);
      let session = payload;
      try {
        const profRes = await fetchProfileApi();
        const prof = safeUnwrapAuthResponse(profRes);
        if (prof?.user) session = prof;
      } catch {
        /* use verify payload */
      }
      if (session?.user) login(session);
      notifySuccess(t('auth.verifyEmailTitle'));
      const role = session?.user?.activeRole ?? currentRole ?? user?.activeRole ?? user?.roles?.[0];
      navigate(safeDashboardPath(role), { replace: true });
    } catch (err) {
      notifyAuthError(err, t, 'otp');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resendLoading) return;
    setResendLoading(true);
    try {
      const res = await resendRegisterOtpApi({ email });
      const data = safeUnwrapAuthResponse(res);
      if (data?.devOtp && import.meta.env.DEV) {
        notifySuccess(`Dev OTP: ${data.devOtp}`);
        const retry = Number(data?.retryAfterSeconds);
        if (Number.isFinite(retry) && retry > 0) setCooldown(retry);
        else setCooldown(45);
      } else if (!isEmailDelivered(data) && !data?.devOtp) {
        const hint = getDeliveryHint(data, t('auth.otpResendNotDelivered'));
        setDeliveryBanner((prev) => ({
          hint,
          reason: data.deliveryReason || prev.reason,
          showWarning: true
        }));
        notifyError(hint);
        const retry = Number(data?.retryAfterSeconds);
        if (Number.isFinite(retry) && retry > 0) setCooldown(retry);
        else setCooldown(45);
      } else {
        notifySuccess(t('auth.resendOtp'));
        setDeliveryBanner((prev) => ({ ...prev, hint: null, reason: null, showWarning: false }));
        const retry = Number(data?.retryAfterSeconds);
        if (Number.isFinite(retry) && retry > 0) setCooldown(retry);
        else setCooldown(45);
      }
    } catch (err) {
      notifyAuthError(err, t, 'otp');
      const retryRaw =
        err?.response?.data?.data?.retryAfterSeconds ??
        err?.response?.data?.retryAfterSeconds ??
        err?.response?.data?.data?.retry_after_seconds;
      const retry = Number(retryRaw);
      if (Number.isFinite(retry) && retry > 0) setCooldown(retry);
    } finally {
      setResendLoading(false);
    }
  }, [cooldown, resendLoading, email, t]);

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
          <div className="tp-auth-v2__glass-content tp-auth-v2__glass-content--login">
            <h1 className="h5 fw-bold mb-2 text-body tp-auth-v2__title">{t('auth.verifyEmailTitle')}</h1>
            <p className="small text-muted mb-3">{t('auth.verifyEmailSubtitle')}</p>
            <p className="small text-body-secondary mb-3">
              <strong className="text-body">{email}</strong>
            </p>
            {deliveryBanner.showWarning && deliveryBanner.hint ? (
              <p
                className="small text-warning-emphasis mb-3 border-start border-warning border-3 ps-2"
                role="status"
              >
                {deliveryBanner.hint}
              </p>
            ) : null}
            <form action="#" method="post" onSubmit={handleVerify} className="tp-auth-login-form" noValidate aria-busy={loading}>
              <div className="mb-3">
                <label className="form-label small" htmlFor="tp-otp-code">
                  {t('auth.otpCodeLabel')}
                </label>
                <input
                  id="tp-otp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-invalid={code.length > 0 && code.replace(/\D/g, '').length < 6}
                  className={`form-control form-control-lg text-center rounded-3 tp-otp-code-field ${isUrdu ? 'text-end' : ''}`}
                  placeholder={t('auth.otpPlaceholder')}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
              </div>
              <Button
                variant="primary"
                className="w-100 py-2 d-flex justify-content-center align-items-center rounded-lg mb-2"
                type="submit"
                disabled={loading || code.replace(/\D/g, '').length !== 6}
                aria-busy={loading}
              >
                {loading ? <Loader light /> : t('auth.verifyButton')}
              </Button>
              <Button
                variant="outline-secondary"
                type="button"
                className="w-100 py-2 rounded-lg mb-3"
                disabled={resendLoading || cooldown > 0}
                onClick={handleResend}
                aria-busy={resendLoading}
              >
                {resendLoading ? (
                  <Loader />
                ) : cooldown > 0 ? (
                  t('auth.resendCooldown', { seconds: cooldown })
                ) : (
                  t('auth.resendOtp')
                )}
              </Button>
            </form>
            <p className="small text-center mt-auto pt-2 mb-0 text-muted tp-auth-v2__footer-line">
              <Link to="/login">{t('auth.backToLogin')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
