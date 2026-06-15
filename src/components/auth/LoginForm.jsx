import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import RoleSelector from './RoleSelector.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { loginApi, fetchProfileApi, patchActiveRoleApi } from '../../services/authService.js';
import PasswordField from '../ui/PasswordField.jsx';
import { mapAuthError, notifyAuthError, notifyUserError } from '../../utils/notifySystem.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { unwrapErrorCode } from '../../utils/unwrapApi.js';
import { safeUnwrapAuthResponse, blockNativeFormSubmit, safeDashboardPath, loginWithTransientRetry } from '../../utils/authApiSafe.js';
import { canAccessAdminRoutes, clearAuthStorage } from '../../utils/authSession.js';
import { isAdminSmartLoginEmail } from '../../utils/adminSmartLogin.js';
import { FaEnvelope } from 'react-icons/fa';

const LoginForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { t, isUrdu } = useLanguage();
  const [form, setForm] = useState({ email: '', password: '' });
  const [uiRolePref, setUiRolePref] = useState('');
  const [formError, setFormError] = useState('');
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
    if (formError) setFormError('');
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRoleChange = (role) => {
    if (formError) setFormError('');
    setUiRolePref(role);
  };

  const emailNorm = form.email.trim().toLowerCase();
  const smartAdmin = isAdminSmartLoginEmail(emailNorm);

  const handleSubmit = async (e) => {
    blockNativeFormSubmit(e);
    if (!smartAdmin && !uiRolePref) {
      const msg = t('errors.roleRequired');
      setFormError(msg);
      notifyUserError(msg);
      return;
    }
    setLoading(true);
    setFormError('');
    clearAuthStorage();
    try {
      const res = await loginWithTransientRetry(loginApi, {
        email: form.email,
        password: form.password,
        roleHint: smartAdmin ? 'admin' : uiRolePref
      });
      const payload = safeUnwrapAuthResponse(res);
      const { token, user } = payload;
      if (!token || !user?.id) {
        clearAuthStorage();
        const msg = t('errors.invalidCredentials');
        setFormError(msg);
        notifyUserError(msg);
        return;
      }

      let session = payload;
      try {
        const profRes = await fetchProfileApi();
        const prof = safeUnwrapAuthResponse(profRes);
        if (prof?.user) {
          session = {
            ...prof,
            token: prof.token || payload.token,
            user: { ...prof.user, activeRole: prof.user.activeRole || payload.user?.activeRole }
          };
        }
      } catch {
        /* use login payload */
      }

      if (canAccessAdminRoutes(session?.user) && session?.user?.activeRole !== 'admin') {
        try {
          const syncRes = await patchActiveRoleApi('admin');
          const synced = safeUnwrapAuthResponse(syncRes);
          if (synced?.user) session = { ...synced, token: synced.token || session.token };
        } catch {
          /* backend forces admin regardless of roleHint */
        }
      }

      const sessionToken = session?.token || token;
      const sessionUser = session?.user || user;
      if (!sessionToken || !sessionUser?.id) {
        clearAuthStorage();
        const msg = t('errors.generic');
        setFormError(msg);
        notifyUserError(msg);
        return;
      }

      login({ ...session, token: sessionToken, user: sessionUser });
      if (smartAdmin && canAccessAdminRoutes(sessionUser)) {
        navigate('/admin/dashboard', { replace: true });
        return;
      }
      const activeRole =
        sessionUser.activeRole ??
        session?.currentRole ??
        user?.activeRole ??
        uiRolePref;
      navigate(safeDashboardPath(activeRole), { replace: true });
    } catch (err) {
      clearAuthStorage();
      const code = unwrapErrorCode(err);
      if (code === 'EMAIL_NOT_VERIFIED') {
        const msg = t('errors.emailNotVerified');
        setFormError(msg);
        notifyUserError(msg);
        navigate('/verify-email', {
          replace: false,
          state: { email: emailNorm, deliveryHint: null }
        });
        return;
      }
      const msg = mapAuthError(err, t, 'login');
      setFormError(msg);
      notifyAuthError(err, t, 'login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form action="#" method="post" noValidate onSubmit={handleSubmit} className="tp-auth-login-form mt-3">
      {!smartAdmin ? <RoleSelector value={uiRolePref} onChange={handleRoleChange} /> : null}
      {formError ? (
        <div className="alert alert-danger py-2 small mb-3" role="alert">
          {formError}
        </div>
      ) : null}
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
        <PasswordField
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder={t('auth.passwordPlaceholder')}
          isUrdu={isUrdu}
          required
          autoComplete="current-password"
        />
      </div>
      <Button
        variant="primary"
        className="w-100 py-2 d-flex justify-content-center align-items-center rounded-lg"
        type="submit"
        disabled={loading}
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
