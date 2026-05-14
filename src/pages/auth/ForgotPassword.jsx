import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import BrandLogo from '../../components/layout/BrandLogo.jsx';
import AuthHeaderActions from '../../components/auth/AuthHeaderActions.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useAuthViewportLock } from '../../hooks/useAuthViewportLock.js';
import { sendForgotPasswordOtpApi } from '../../services/authService.js';
import { unwrapResponseData } from '../../utils/unwrapApi.js';
import { formatUserError } from '../../utils/userErrors.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { FaEnvelope } from 'react-icons/fa';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { t, isUrdu } = useLanguage();
  useAuthViewportLock();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await sendForgotPasswordOtpApi({ email: email.trim().toLowerCase() });
      const data = unwrapResponseData(res) || {};
      if (data?.devOtp && import.meta.env.DEV) {
        notifySuccess(`Dev OTP: ${data.devOtp}`);
        navigate('/reset-password', { replace: false, state: { email: email.trim().toLowerCase() } });
        return;
      }
      if (!data.sent && data.deliveryHint) {
        notifyError(data.deliveryHint);
        return;
      }
      notifySuccess(t('auth.forgotSubtitle'));
      navigate('/reset-password', { replace: false, state: { email: email.trim().toLowerCase() } });
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('errors.generic') }));
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="h5 fw-bold mb-2 text-body tp-auth-v2__title">{t('auth.forgotTitle')}</h1>
            <p className="small text-muted mb-3">{t('auth.forgotSubtitle')}</p>
            <form onSubmit={handleSubmit} className="tp-auth-login-form mt-2">
              <div className="mb-3">
                <label className="form-label small">{t('auth.email')}</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text tp-input-group-addon">
                    <FaEnvelope className="tp-input-icon" />
                  </span>
                  <input
                    type="email"
                    className={`form-control rounded-3 ${isUrdu ? 'text-end' : ''}`}
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button
                variant="primary"
                className="w-100 py-2 d-flex justify-content-center align-items-center rounded-lg mb-2"
                type="submit"
                disabled={loading}
              >
                {loading ? <Loader light /> : t('auth.sendResetCode')}
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

export default ForgotPassword;
