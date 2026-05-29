import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import RoleSelector from './RoleSelector.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { registerApi, fetchProfileApi, addRoleApi } from '../../services/authService.js';
import { notifySuccess, notifyError } from '../ui/ToastProvider.jsx';
import { notifyAuthError } from '../../utils/notifySystem.js';
import { formatUserError } from '../../utils/userErrors.js';
import { useAuth } from '../../hooks/useAuth.js';
import { safeUnwrapAuthResponse } from '../../utils/authApiSafe.js';
import { isEmailDelivered, getDeliveryHint } from '../../utils/otpDelivery.js';
import { blockNativeFormSubmit, safeDashboardPath } from '../../utils/authApiSafe.js';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { FaUser, FaEnvelope, FaIdCard } from 'react-icons/fa';
import PasswordField from '../ui/PasswordField.jsx';

const CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/;

const RegisterForm = ({ prefill: prefillProp = null, upgradeRole: upgradeRoleProp = null, onDone }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const { t, isUrdu } = useLanguage();
  const prefill = useMemo(() => prefillProp || location.state?.prefill || null, [prefillProp, location.state]);
  const upgradeRole = useMemo(() => upgradeRoleProp || location.state?.upgradeRole || null, [upgradeRoleProp, location.state]);

  const [form, setForm] = useState(() => ({
    name: prefill?.name || '',
    email: prefill?.email || '',
    password: '',
    confirmPassword: '',
    cnic: prefill?.cnic || '',
    phone: prefill?.phone || '',
    role: upgradeRole || ''
  }));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // If navigation state changes (rare), sync prefill once
    if (prefill || upgradeRole) {
      setForm((prev) => ({
        ...prev,
        name: prefill?.name ?? prev.name,
        email: prefill?.email ?? prev.email,
        cnic: prefill?.cnic ?? prev.cnic,
        phone: prefill?.phone ?? prev.phone,
        role: upgradeRole || prev.role
      }));
    }
  }, [prefill, upgradeRole]);

  useEffect(() => {
    const handler = () => {
      setForm((prev) => ({ ...prev, role: '' }));
    };
    window.addEventListener('tp_register_reset_role', handler);
    return () => window.removeEventListener('tp_register_reset_role', handler);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'cnic') {
      const digits = value.replace(/\D/g, '').slice(0, 13);
      const formatted =
        digits.length <= 5
          ? digits
          : digits.length <= 12
          ? `${digits.slice(0, 5)}-${digits.slice(5)}`
          : `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
      setForm((prev) => ({ ...prev, cnic: formatted }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.name?.trim()) newErrors.name = t('errors.nameRequired');
    if (!form.email?.trim()) newErrors.email = t('errors.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = t('errors.emailInvalid');
    if (!form.role) newErrors.role = t('errors.roleRequired');
    if (!form.password) newErrors.password = t('errors.passwordRequired');
    else if (form.password.length < 8) newErrors.password = t('errors.passwordTooShort');
    if (!form.confirmPassword) newErrors.confirmPassword = t('errors.confirmPasswordRequired');
    else if (form.password !== form.confirmPassword) {
      newErrors.password = t('errors.passwordsDoNotMatch');
      newErrors.confirmPassword = t('errors.passwordsDoNotMatch');
    }
    if (!form.cnic?.trim()) newErrors.cnic = t('errors.cnicRequired');
    else if (!CNIC_REGEX.test(form.cnic.trim())) newErrors.cnic = t('errors.cnicInvalid');
    if (!form.phone?.trim()) newErrors.phone = t('errors.phoneRequired');
    else {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) newErrors.phone = t('errors.phoneInvalid');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    blockNativeFormSubmit(e);
    setError('');
    setSuccess('');
    if (!validate()) return;
    setLoading(true);
    try {
      if (upgradeRole && user?.id) {
        const res = await addRoleApi(upgradeRole);
        const payload = safeUnwrapAuthResponse(res);
        if (payload?.token) {
          const { setAuthToken } = await import('../../utils/authTokenStorage.js');
          setAuthToken(payload.token);
        }
        let session = payload;
        try {
          const profRes = await fetchProfileApi();
          const prof = safeUnwrapAuthResponse(profRes);
          if (prof?.user) session = prof;
        } catch {
          /* use add-role payload */
        }
        login(session);
        notifySuccess(t('auth.roleAddedSuccess'));
        onDone?.(session?.user);
        const role = session?.user?.activeRole ?? upgradeRole;
        navigate(safeDashboardPath(role), { replace: true });
        return;
      }

      const res = await registerApi({
        name: form.name,
        email: form.email,
        phone: form.phone,
        CNIC: form.cnic,
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: form.role
      });
      const payload = safeUnwrapAuthResponse(res);
      const { token, user, currentRole, registrationKind, emailVerification } = payload;
      const mergedOrExisting = registrationKind === 'merged' || registrationKind === 'existing';
      const isPendingSignup = registrationKind === 'pending';
      notifySuccess(
        upgradeRole || (mergedOrExisting && token)
          ? t('auth.roleAddedSuccess')
          : mergedOrExisting && !token
          ? t('auth.verifyEmailToContinue')
          : isPendingSignup
          ? t('auth.verifyEmailToContinue')
          : t('auth.accountCreatedSuccess')
      );

      const shouldAutoLogin = Boolean(token && user) && (upgradeRole || mergedOrExisting);
      if (shouldAutoLogin) {
        if (token) {
          const { setAuthToken } = await import('../../utils/authTokenStorage.js');
          setAuthToken(token);
        }
        let session = payload;
        try {
          const profRes = await fetchProfileApi();
          const prof = safeUnwrapAuthResponse(profRes);
          if (prof?.user) session = prof;
        } catch {
          /* use register payload */
        }
        login(session);
        onDone?.(user);
        const role = session?.user?.activeRole ?? currentRole ?? user?.activeRole ?? user?.roles?.[0];
        navigate(safeDashboardPath(role), { replace: true });
        return;
      }

      if (import.meta.env.DEV && emailVerification?.devOtp) {
        notifySuccess(`Dev OTP: ${emailVerification.devOtp}`);
      } else if (emailVerification && !isEmailDelivered(emailVerification)) {
        const hint = getDeliveryHint(emailVerification, t('auth.otpResendNotDelivered'));
        if (hint) notifyError(hint);
      }

      onDone?.(user);
      navigate('/verify-email', {
        replace: true,
        state: {
          email: form.email.trim().toLowerCase(),
          emailDelivered: emailVerification ? isEmailDelivered(emailVerification) : true,
          deliveryHint: getDeliveryHint(emailVerification, '') || null,
          deliveryReason: emailVerification?.deliveryReason || null
        }
      });
    } catch (err) {
      notifyAuthError(err, t, 'register');
      setError(formatUserError(err, t, { fallback: t('errors.generic') }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form action="#" method="post" noValidate onSubmit={handleSubmit} className="tp-auth-register-form mt-2">
      {error && (
        <div className="alert alert-danger py-2 small" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success py-2 small" role="alert">
          {success}
        </div>
      )}
      {!upgradeRole && (
        <RoleSelector value={form.role} onChange={(role) => setForm((prev) => ({ ...prev, role }))} />
      )}
      {upgradeRole && (
        <RoleSelector
          value={form.role}
          onChange={(role) => setForm((prev) => ({ ...prev, role }))}
          onlyRole={upgradeRole}
        />
      )}
      <div className="mb-2">
        <label className="form-label small">{t('auth.fullName')} *</label>
        <div className="input-group input-group-sm">
          <span className="input-group-text tp-input-group-addon">
            <FaUser className="tp-input-icon" />
          </span>
          <input
            type="text"
            name="name"
            className={`form-control rounded-3 ${errors.name ? 'is-invalid' : ''} ${isUrdu ? 'text-end' : ''}`}
            placeholder={t('auth.fullNamePlaceholder')}
            value={form.name}
            onChange={handleChange}
          />
        </div>
        {errors.name && <div className="invalid-feedback">{errors.name}</div>}
      </div>
      <div className="mb-2">
        <label className="form-label small">{t('auth.email')} *</label>
        <div className="input-group input-group-sm">
          <span className="input-group-text tp-input-group-addon">
            <FaEnvelope className="tp-input-icon" />
          </span>
          <input
            type="email"
            name="email"
            className={`form-control rounded-3 ${errors.email ? 'is-invalid' : ''} ${isUrdu ? 'text-end' : ''}`}
            placeholder={t('auth.emailPlaceholder')}
            value={form.email}
            onChange={handleChange}
          />
        </div>
        {errors.email && <div className="invalid-feedback">{errors.email}</div>}
      </div>
      <div className="mb-2">
        <label className="form-label small">{t('auth.cnic')} *</label>
        <div className="input-group input-group-sm">
          <span className="input-group-text tp-input-group-addon">
            <FaIdCard className="tp-input-icon" />
          </span>
          <input
            type="text"
            name="cnic"
            className={`form-control rounded-3 ${errors.cnic ? 'is-invalid' : ''} ${isUrdu ? 'text-end' : ''}`}
            placeholder={t('auth.cnicPlaceholder')}
            value={form.cnic}
            onChange={handleChange}
            maxLength={15}
          />
        </div>
        {errors.cnic && <div className="invalid-feedback">{errors.cnic}</div>}
      </div>
      <div className="mb-2">
        <label className="form-label small">{t('auth.mobile')} *</label>
        <div className={`tp-phone-wrap ${errors.phone ? 'is-invalid' : ''}`}>
          <PhoneInput
            country={'pk'}
            value={form.phone}
            onChange={(value) => {
              const cleaned = String(value || '').replace(/^0+/, '');
              setForm((prev) => ({ ...prev, phone: `+${cleaned}`.trim() }));
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: null }));
            }}
            inputProps={{ name: 'phone', required: true }}
            placeholder={t('auth.phonePlaceholder')}
            containerClass="w-100"
            inputClass={`form-control form-control-sm rounded-3 ${isUrdu ? 'text-end' : ''}`}
            buttonClass="rounded-3"
            enableSearch
          />
        </div>
        {errors.phone && <div className="invalid-feedback d-block">{errors.phone}</div>}
      </div>
      <div className="mb-3">
        <label className="form-label small">{t('auth.password')} *</label>
        <PasswordField
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder={t('auth.passwordPlaceholder')}
          invalid={Boolean(errors.password)}
          isUrdu={isUrdu}
          autoComplete="new-password"
        />
        {errors.password && <div className="invalid-feedback">{errors.password}</div>}
      </div>
      <div className="mb-3">
        <label className="form-label small">{t('auth.confirmPassword')} *</label>
        <PasswordField
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={handleChange}
          placeholder={t('auth.reenterPasswordPlaceholder')}
          invalid={Boolean(errors.confirmPassword)}
          isUrdu={isUrdu}
          autoComplete="new-password"
        />
        {errors.confirmPassword && <div className="invalid-feedback">{errors.confirmPassword}</div>}
      </div>
      <div className="d-flex flex-column flex-sm-row gap-2">
        <Button
          variant="outline-secondary"
          type="button"
          className="flex-sm-fill py-2 rounded-lg"
          disabled={loading}
          onClick={() => {
            if (upgradeRole) {
              navigate(safeDashboardPath(user?.activeRole ?? user?.roles?.[0]), { replace: true });
              return;
            }
            navigate('/login', { replace: false });
          }}
        >
          {t('auth.cancelRegistration')}
        </Button>
        <Button
          variant="primary"
          className="flex-sm-fill py-2 d-flex justify-content-center align-items-center rounded-lg"
          type="submit"
          disabled={
            loading ||
            (form.password && form.confirmPassword && form.password !== form.confirmPassword) ||
            !form.role
          }
        >
          {loading ? <Loader light /> : t('auth.createAccountButton')}
        </Button>
      </div>
    </form>
  );
};

export default RegisterForm;

