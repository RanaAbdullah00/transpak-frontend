import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import RoleSelector from './RoleSelector.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { loginApi } from '../../services/authService.js';
import { notifySuccess, notifyError } from '../ui/ToastProvider.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { unwrapErrorCode } from '../../utils/unwrapApi.js';
import { safeUnwrapAuthResponse, getAuthUiError, blockNativeFormSubmit, safeDashboardPath } from '../../utils/authApiSafe.js';
import { FaEnvelope, FaLock } from 'react-icons/fa';

const DEMO_ADMIN_EMAIL = String(import.meta.env.VITE_DEMO_ADMIN_EMAIL || '')
  .trim()
  .toLowerCase();

const LoginForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { t, isUrdu } = useLanguage();
  const [form, setForm] = useState({ email: '', password: '' });
  const [uiRolePref, setUiRolePref] = useState('');

  React.useEffect(() => {
    const pre = location.state?.prefill?.email;
    if (typeof pre === 'string' && pre.trim()) {
      setForm((prev) => ({ ...prev, email: pre.trim() }));
    }
  }, [location.state]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const handler = () => setUiRolePref('');
    window.addEventListener('tp_login_reset_role', handler);
    return () => window.removeEventListener('tp_login_reset_role', handler);
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const emailNorm = form.email.trim().toLowerCase();
  const isDemoAdmin = DEMO_ADMIN_EMAIL.length > 0 && emailNorm === DEMO_ADMIN_EMAIL;

  const handleSubmit = async (e) => {
    blockNativeFormSubmit(e);
    if (!uiRolePref && !isDemoAdmin) {
      notifyError(t('errors.roleRequired'));
      return;
    }
    setLoading(true);
    try {
      const res = await loginApi({
        email: form.email,
        password: form.password,
        ...(isDemoAdmin ? {} : { roleHint: uiRolePref })
      });
      const payload = safeUnwrapAuthResponse(res);
      const { token, user, currentRole } = payload;
      if (token) localStorage.setItem('transpak_token', token);
      if (user) login(payload);
      notifySuccess(t('auth.welcomeBack'));
      const activeRole = user?.activeRole ?? currentRole;
      navigate(safeDashboardPath(activeRole), { replace: true });
    } catch (err) {
      const code = unwrapErrorCode(err);
      if (code === 'EMAIL_NOT_VERIFIED') {
        notifyError(t('errors.emailNotVerified'));
        navigate('/verify-email', {
          replace: false,
          state: { email: emailNorm, deliveryHint: null }
        });
        return;
      }
      const raw = getAuthUiError(err, t);
      const translated =
        code === 'INVALID_CREDENTIALS'
          ? t('errors.invalidCredentials')
          : code === 'ACCOUNT_BLOCKED'
          ? t('errors.accountBlocked')
          : raw;
      notifyError(translated);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form action="#" method="post" noValidate onSubmit={handleSubmit} className="tp-auth-login-form mt-3">
      <RoleSelector value={uiRolePref} onChange={setUiRolePref} />
      <div className="mb-2">
        <label className="form-label small">{t('auth.email')}</label>
        <div className="input-group input-group-sm">
          <span className="input-group-text tp-input-group-addon">
            <FaEnvelope className="tp-input-icon" />
          </span>
          <input
            type="email"
            name="email"
            className={`form-control rounded-3 ${isUrdu ? 'text-end' : ''}`}
            placeholder={t('auth.emailPlaceholder')}
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      <div className="mb-3">
        <label className="form-label small">{t('auth.password')}</label>
        <div className="input-group input-group-sm">
          <span className="input-group-text tp-input-group-addon">
            <FaLock className="tp-input-icon" />
          </span>
          <input
            type="password"
            name="password"
            className={`form-control rounded-3 ${isUrdu ? 'text-end' : ''}`}
            placeholder={t('auth.passwordPlaceholder')}
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      <Button
        variant="primary"
        className="w-100 py-2 d-flex justify-content-center align-items-center rounded-lg"
        type="submit"
        disabled={loading || (!isDemoAdmin && !uiRolePref)}
      >
        {loading ? <Loader light /> : t('auth.signInButton')}
      </Button>
      <div className="text-center mt-2">
        <Link to="/forgot-password" className="small text-decoration-none">
          {t('auth.forgotPassword')}
        </Link>
      </div>
    </form>
  );
};

export default LoginForm;
