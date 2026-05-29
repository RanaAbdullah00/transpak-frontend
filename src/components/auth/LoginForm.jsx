import React, { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import RoleSelector from './RoleSelector.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { loginApi, fetchProfileApi, patchActiveRoleApi } from '../../services/authService.js';
import PasswordField from '../ui/PasswordField.jsx';
import { notifySuccess } from '../ui/ToastProvider.jsx';
import { notifyAuthError, notifyUserError } from '../../utils/notifySystem.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { unwrapErrorCode } from '../../utils/unwrapApi.js';
import { safeUnwrapAuthResponse, blockNativeFormSubmit, safeDashboardPath } from '../../utils/authApiSafe.js';
import { applyDemoAdminSession } from '../../utils/authSession.js';
import { FaEnvelope } from 'react-icons/fa';

const DEMO_ADMIN_EMAIL = String(import.meta.env.VITE_DEMO_ADMIN_EMAIL || '')
  .trim()
  .toLowerCase();

/** FYP demo admin — auto-login only for this exact credential pair. */
const QUICK_DEMO_EMAIL = 'mrrajpoot.327@gmail.com';
const QUICK_DEMO_PASSWORD = '11223344';

const LoginForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { t, isUrdu } = useLanguage();
  const [form, setForm] = useState({ email: '', password: '' });
  const [uiRolePref, setUiRolePref] = useState('');
  const autoLoginAttempted = useRef(false);

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
  const isDemoAdmin =
    (DEMO_ADMIN_EMAIL.length > 0 && emailNorm === DEMO_ADMIN_EMAIL) ||
    emailNorm === QUICK_DEMO_EMAIL;

  const handleSubmit = async (e) => {
    blockNativeFormSubmit(e);
    if (!uiRolePref && !isDemoAdmin) {
      notifyUserError(t('errors.roleRequired'));
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
      if (token) {
        const { setAuthToken } = await import('../../utils/authSession.js');
        setAuthToken(token);
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
      if (isDemoAdmin && session?.user?.activeRole !== 'admin') {
        try {
          const syncRes = await patchActiveRoleApi('admin');
          const synced = safeUnwrapAuthResponse(syncRes);
          if (synced?.token) {
            const { setAuthToken } = await import('../../utils/authTokenStorage.js');
            setAuthToken(synced.token);
          }
          if (synced?.user) session = { ...synced, token: synced.token || session.token };
        } catch {
          /* keep login session */
        }
      }
      const sessionToStore = applyDemoAdminSession(session, emailNorm);
      if (sessionToStore?.user) login(sessionToStore);
      notifySuccess(t('auth.welcomeBack'));
      const activeRole =
        sessionToStore?.user?.activeRole ??
        sessionToStore?.currentRole ??
        user?.activeRole ??
        currentRole;
      navigate(safeDashboardPath(activeRole), { replace: true });
    } catch (err) {
      const code = unwrapErrorCode(err);
      if (code === 'EMAIL_NOT_VERIFIED') {
        notifyUserError(t('errors.emailNotVerified'));
        navigate('/verify-email', {
          replace: false,
          state: { email: emailNorm, deliveryHint: null }
        });
        return;
      }
      notifyAuthError(err, t, 'login');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (loading || autoLoginAttempted.current) return;
    if (emailNorm !== QUICK_DEMO_EMAIL || form.password !== QUICK_DEMO_PASSWORD) return;
    autoLoginAttempted.current = true;
    handleSubmit({ preventDefault: () => {} });
  }, [emailNorm, form.password, loading]);

  return (
    <form action="#" method="post" noValidate onSubmit={handleSubmit} className="tp-auth-login-form mt-3">
      {!isDemoAdmin ? <RoleSelector value={uiRolePref} onChange={setUiRolePref} /> : null}
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
