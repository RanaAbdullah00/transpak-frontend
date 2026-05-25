import React, { useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import ProfileRateUsersPanel from './ProfileRateUsersPanel.jsx';
import ProfileReviewsPanel from './ProfileReviewsPanel.jsx';
import ProfileRolePanel from './ProfileRolePanel.jsx';
import { fetchProfileApi } from '../../services/authService.js';
import { safeUnwrapAuthResponse } from '../../utils/authApiSafe.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError } from '../ui/ToastProvider.jsx';
import { notifySystem, SystemNotifyType } from '../../utils/notifySystem.js';
import { unwrapErrorMessage } from '../../utils/unwrapApi.js';
import { formatUserError } from '../../utils/userErrors.js';
import { shouldUseAdminShell } from '../../utils/rbac.js';
import SafeAvatar from '../ui/SafeAvatar.jsx';
import SafeImage from '../ui/SafeImage.jsx';
import { resolveImageUrl } from '../../utils/imageUrl.js';

const CNIC_REGEX = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;
const PROFILE_FIELD_COUNT = 6;

function profileFormFromUser(user, row = null) {
  if (!user && !row) {
    return {
      full_name: '',
      email: '',
      phone: '',
      cnic_number: '',
      cnic_image: '',
      cnic_image_back: '',
      profile_image: ''
    };
  }
  return {
    full_name: row?.full_name ?? user?.fullName ?? user?.name ?? '',
    email: row?.email ?? user?.email ?? '',
    phone: row?.phone ?? user?.phone ?? '',
    cnic_number: row?.cnic_number ?? user?.cnicNumber ?? user?.cnic ?? '',
    cnic_image: row?.cnic_image ?? user?.cnicImage ?? '',
    cnic_image_back: row?.cnic_image_back ?? '',
    profile_image: row?.profile_image ?? user?.profileImage ?? user?.profile_image ?? ''
  };
}

function imageFieldUrl(value) {
  const url = resolveImageUrl(value);
  if (url) return url;
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, 'https://');
  return '';
}

function initialsFrom(name, email) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length) return parts[0].slice(0, 2).toUpperCase();
  const e = String(email || '').trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return '?';
}

/**
 * @param {{ showTabs: boolean, onSaved?: () => void }} props
 */
const ProfileEditor = ({ showTabs, onSaved }) => {
  const { user, login } = useAuth();
  const { request } = useApi();
  const { t } = useLanguage();
  const [tab, setTab] = useState('basic');
  const [form, setForm] = useState(() => profileFormFromUser(user));
  const [files, setFiles] = useState({ cnic_image: null, cnic_image_back: null, profile_image: null });
  const [cnicLocked, setCnicLocked] = useState(Boolean(user?.cnicNumber || user?.cnic));
  const [loading, setLoading] = useState(false);
  const [profileHydrating, setProfileHydrating] = useState(true);
  const [profileComplete, setProfileComplete] = useState(Boolean(user?.profileComplete));

  useEffect(() => {
    if (!user?.id) return;
    setForm(profileFormFromUser(user));
    setProfileComplete(Boolean(user.profileComplete));
    setProfileHydrating(true);
    let cancelled = false;
    const run = async () => {
      try {
        const u = await request({ method: 'GET', url: '/profile' });
        if (cancelled) return;
        setForm(profileFormFromUser(user, u));
        setCnicLocked(Boolean(u.cnic_number));
        setProfileComplete(Boolean(u.is_profile_complete));
      } catch (err) {
        if (!cancelled) {
          setForm((prev) => ({ ...prev, email: user.email || prev.email }));
          notifyError(formatUserError(err, t, { fallback: t('profile.loadFailed') }));
        }
      } finally {
        if (!cancelled) setProfileHydrating(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, request]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const canEditCnic = !cnicLocked;
  const cnicValid = useMemo(() => {
    if (!form.cnic_number) return true;
    return CNIC_REGEX.test(String(form.cnic_number).trim());
  }, [form.cnic_number]);

  const dpInitials = useMemo(
    () => initialsFrom(form.full_name, form.email),
    [form.full_name, form.email]
  );

  const missingProfilePieces = useMemo(() => {
    const m = [];
    if (!String(form.full_name || '').trim()) m.push({ key: 'full_name', label: t('auth.fullName') });
    if (!String(form.phone || '').trim()) m.push({ key: 'phone', label: t('auth.mobile') });
    if (!String(form.cnic_number || '').trim()) m.push({ key: 'cnic_number', label: t('auth.cnic') });
    if (!imageFieldUrl(form.cnic_image)) m.push({ key: 'cnic_image', label: t('profile.cnicFront') });
    if (!imageFieldUrl(form.cnic_image_back)) m.push({ key: 'cnic_image_back', label: t('profile.cnicBack') });
    if (!imageFieldUrl(form.profile_image)) m.push({ key: 'profile_image', label: t('profile.profilePhoto') });
    return m;
  }, [form, t]);

  const completionPercent = useMemo(() => {
    if (profileComplete) return 100;
    const n = missingProfilePieces.length;
    return Math.max(0, Math.min(100, Math.round(((PROFILE_FIELD_COUNT - n) / PROFILE_FIELD_COUNT) * 100)));
  }, [profileComplete, missingProfilePieces.length]);

  const cnicFrontUrl = imageFieldUrl(form.cnic_image);
  const cnicBackUrl = imageFieldUrl(form.cnic_image_back);
  const profilePhotoUrl = imageFieldUrl(form.profile_image);

  const handleSave = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      if (form.full_name) fd.append('full_name', form.full_name);
      if (form.phone) fd.append('phone', form.phone);
      if (canEditCnic && form.cnic_number) fd.append('cnic_number', form.cnic_number);
      if (files.profile_image) fd.append('profile_image', files.profile_image);
      if (files.cnic_image) fd.append('cnic_image', files.cnic_image);
      if (files.cnic_image_back) fd.append('cnic_image_back', files.cnic_image_back);

      const updated = await request({
        method: 'PUT',
        url: '/profile/update',
        data: fd
      });
      if (updated) {
        const prof = updated.profile || updated;
        setForm((p) => ({
          ...p,
          full_name: prof.full_name || '',
          phone: prof.phone || '',
          cnic_number: prof.cnic_number || '',
          cnic_image: prof.cnic_image || '',
          cnic_image_back: prof.cnic_image_back || '',
          profile_image: prof.profile_image || ''
        }));
        setCnicLocked(Boolean(prof.cnic_number));
        setProfileComplete(Boolean(prof.is_profile_complete));
        setFiles({ cnic_image: null, cnic_image_back: null, profile_image: null });
        if (updated.token && updated.user) {
          login(updated);
        } else {
          try {
            const profRes = await fetchProfileApi();
            const fresh = safeUnwrapAuthResponse(profRes);
            if (fresh?.user) login(fresh);
          } catch {
            /* form state already updated */
          }
        }
        onSaved?.();
        notifySystem(SystemNotifyType.PROFILE_UPDATED, t('common.save'));
        if (Array.isArray(updated.upload_failures) && updated.upload_failures.length) {
          notifyError(t('errors.fileUploadPartial'));
        }
      }
    } catch (err) {
      const status = err?.response?.status;
      const raw = unwrapErrorMessage(err);
      if (status === 503) {
        if (/not configured/i.test(raw || '')) notifyError(t('errors.storageNotConfigured'));
        else notifyError(t('errors.fileUploadFailed'));
      } else {
        notifyError(formatUserError(err, t, { fallback: t('profile.saveFailed') }));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <Loader />;

  if (shouldUseAdminShell(user)) {
    return (
      <div className="tp-profile-section rounded-4 p-4 border shadow-sm">
        <p className="fw-semibold mb-2">{t('profile.adminAccountTitle')}</p>
        <p className="small tp-secondary-text mb-0">{t('profile.adminAccountBody')}</p>
      </div>
    );
  }

  const tabBtn = (id, label) => (
    <li className="nav-item" key={id}>
      <button
        type="button"
        className={`nav-link py-2 px-2 small ${tab === id ? 'active' : ''}`}
        onClick={() => setTab(id)}
      >
        {label}
      </button>
    </li>
  );

  const profileSummary = profileComplete && showTabs;

  const photoBlock = (
    <div className="mb-3">
      <div
        className="rounded-circle overflow-hidden border mx-auto"
        style={{ width: 72, height: 72, borderColor: 'var(--pak-border)' }}
      >
        {profilePhotoUrl ? (
          <SafeAvatar
            src={profilePhotoUrl}
            name={form.full_name || user?.name}
            email={user?.email}
            imgClassName="tp-img-cover"
          />
        ) : (
          <div className="w-100 h-100 d-flex align-items-center justify-content-center tp-profile-avatar-fallback small">
            {dpInitials}
          </div>
        )}
      </div>
    </div>
  );

  const cnicReadOnlyBlock = (
    <div className="mt-3 pt-3 border-top border-opacity-25">
      <p className="small fw-semibold mb-2">{t('auth.cnic')}</p>
      <p className="mb-2 small">
        <strong className="text-body-secondary">{t('auth.cnic')}:</strong> {form.cnic_number || t('common.emDash')}
      </p>
      {!cnicFrontUrl && !cnicBackUrl ? (
        <p className="tp-secondary-text small mb-0">{t('profile.noCnicScans')}</p>
      ) : (
        <div className="row g-2">
          {cnicFrontUrl ? (
            <div className="col-6" key="cnic-front-preview">
              <div className="tp-secondary-text small mb-1">{t('profile.cnicFrontShort')}</div>
              <SafeImage
                src={cnicFrontUrl}
                alt=""
                className="w-100 rounded border"
                style={{ maxHeight: 120, objectFit: 'cover' }}
                fallback={<p className="tp-secondary-text small mb-0 fst-italic">{t('profile.notOnFile')}</p>}
              />
            </div>
          ) : (
            <div className="col-6" key="cnic-front-missing">
              <div className="tp-secondary-text small mb-1">{t('profile.cnicFrontShort')}</div>
              <p className="tp-secondary-text small mb-0 fst-italic">{t('profile.notOnFile')}</p>
            </div>
          )}
          {cnicBackUrl ? (
            <div className="col-6" key="cnic-back-preview">
              <div className="tp-secondary-text small mb-1">{t('profile.cnicBackShort')}</div>
              <SafeImage
                src={cnicBackUrl}
                alt=""
                className="w-100 rounded border"
                style={{ maxHeight: 120, objectFit: 'cover' }}
                fallback={<p className="tp-secondary-text small mb-0 fst-italic">{t('profile.notOnFile')}</p>}
              />
            </div>
          ) : (
            <div className="col-6" key="cnic-back-missing">
              <div className="tp-secondary-text small mb-1">{t('profile.cnicBackShort')}</div>
              <p className="tp-secondary-text small mb-0 fst-italic">{t('profile.notOnFile')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const cnicEditableBlock = (
    <div className="mt-3 pt-3 border-top border-opacity-25">
      <label className="form-label small fw-semibold text-body">{t('auth.cnic')}</label>
      <input
        name="cnic_number"
        className={`form-control form-control-sm mb-2 ${cnicValid ? '' : 'is-invalid'}`}
        value={form.cnic_number}
        onChange={handleChange}
        disabled={!canEditCnic}
        placeholder={t('auth.cnicPlaceholder')}
      />
      {!cnicValid ? <div className="invalid-feedback d-block">{t('errors.cnicInvalid')}</div> : null}
      {cnicFrontUrl ? (
        <div className="mb-2">
          <div className="tp-secondary-text small mb-1">{t('profile.cnicOnFileFront')}</div>
          <SafeImage
            src={cnicFrontUrl}
            alt=""
            className="w-100 rounded border"
            style={{ maxHeight: 100, objectFit: 'cover' }}
            fallback={<p className="tp-secondary-text small mb-0 fst-italic">{t('profile.notOnFile')}</p>}
          />
        </div>
      ) : (
        <>
          <label className="form-label small fw-semibold text-body">{t('profile.cnicFrontLabel')}</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="form-control form-control-sm mb-2"
            onChange={(e) => setFiles((p) => ({ ...p, cnic_image: e.target.files?.[0] || null }))}
          />
        </>
      )}
      {cnicBackUrl ? (
        <div className="mb-2">
          <div className="tp-secondary-text small mb-1">{t('profile.cnicOnFileBack')}</div>
          <SafeImage
            src={cnicBackUrl}
            alt=""
            className="w-100 rounded border"
            style={{ maxHeight: 100, objectFit: 'cover' }}
            fallback={<p className="tp-secondary-text small mb-0 fst-italic">{t('profile.notOnFile')}</p>}
          />
        </div>
      ) : (
        <>
          <label className="form-label small fw-semibold text-body">{t('profile.cnicBackLabel')}</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="form-control form-control-sm mb-0"
            onChange={(e) => setFiles((p) => ({ ...p, cnic_image_back: e.target.files?.[0] || null }))}
          />
        </>
      )}
    </div>
  );

  const basicTabContent =
    profileSummary ? (
      <div className="small text-body">
        <div className="mb-2">{photoBlock}</div>
        <p className="mb-1 text-break">
          <strong>{t('auth.fullName')}:</strong> {form.full_name || t('common.emDash')}
        </p>
        <p className="mb-1 text-break">
          <strong>{t('auth.mobile')}:</strong> {form.phone || t('common.emDash')}
        </p>
        <p className="mb-0 text-break">
          <strong>{t('auth.email')}:</strong> {form.email}
        </p>
        {cnicReadOnlyBlock}
      </div>
    ) : (
      <>
        {photoBlock}
        <label className="form-label small fw-semibold text-body">
          {t('auth.fullName')} ({t('profile.fullNamePhoto')})
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="form-control form-control-sm mb-3"
          onChange={(e) => setFiles((p) => ({ ...p, profile_image: e.target.files?.[0] || null }))}
        />
        <div className="row g-2">
          <div className="col-12">
            <label className="form-label small fw-semibold text-body">{t('auth.fullName')}</label>
            <input
              name="full_name"
              className="form-control form-control-sm"
              value={form.full_name}
              onChange={handleChange}
            />
          </div>
          <div className="col-12">
            <label className="form-label small fw-semibold text-body">{t('profile.emailReadOnly')}</label>
            <input className="form-control form-control-sm" value={form.email} disabled readOnly />
          </div>
          <div className="col-12">
            <label className="form-label small fw-semibold text-body">{t('auth.mobile')}</label>
            <input name="phone" className="form-control form-control-sm" value={form.phone} onChange={handleChange} />
          </div>
        </div>
        {cnicEditableBlock}
        <div className="d-flex justify-content-end mt-3">
          <Button variant="primary" onClick={handleSave} disabled={loading}>
            {loading ? <Loader light size="sm" /> : t('common.save')}
          </Button>
        </div>
      </>
    );

  const rolePane = <ProfileRolePanel />;

  const statusPane = profileHydrating ? (
    <div className="tp-profile-section rounded-4 p-4 border shadow-sm text-center">
      <Loader />
      <p className="small tp-secondary-text mt-2 mb-0">{t('profile.loadingProfile')}</p>
    </div>
  ) : (
    <div className="d-flex flex-column gap-3">
      <div className="tp-profile-section rounded-4 p-3 border shadow-sm">
        <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
          <span className="small tp-secondary-text text-uppercase fw-semibold">{t('profile.completionProgress')}</span>
          <span className="fw-bold">{completionPercent}%</span>
        </div>
        <div className="progress rounded-pill tp-profile-completion-progress" style={{ height: 10 }}>
          <div
            className={`progress-bar tp-profile-completion-bar ${profileComplete ? 'bg-success' : 'bg-primary'}`}
            style={{ width: `${completionPercent}%` }}
            role="progressbar"
            aria-valuenow={completionPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {profileComplete && showTabs ? (
        <div className="tp-profile-section rounded-4 p-3 border shadow-sm text-center">
          <div className="mb-2">
            <span className="badge bg-success rounded-pill px-3 py-2">{t('profile.fullyVerifiedBadge')}</span>
          </div>
          <p className="fw-semibold mb-1">{t('profile.fullyVerifiedTitle')}</p>
          <p className="small tp-secondary-text mb-3">{t('profile.fullyVerifiedBody')}</p>
          <div className="small text-start text-body">
            <p className="mb-1 text-break">
              <strong>{t('auth.fullName')}:</strong> {form.full_name || t('common.emDash')}
            </p>
            <p className="mb-1 text-break">
              <strong>{t('auth.mobile')}:</strong> {form.phone || t('common.emDash')}
            </p>
            <p className="mb-1 text-break">
              <strong>{t('auth.cnic')}:</strong> {form.cnic_number || t('common.emDash')}
            </p>
            <p className="mb-0 text-break">
              <strong>{t('profile.roleSummary')}:</strong> {user?.activeRole || t('common.emDash')} (
              {(user?.roles || []).join(', ') || t('common.emDash')})
            </p>
          </div>
        </div>
      ) : (
        <div className="tp-profile-section rounded-4 p-3 border shadow-sm">
          <p className="tp-secondary-text small mb-2">{t('profile.completionHint')}</p>
          {missingProfilePieces.length === 0 ? (
            <p className="small mb-3">{t('profile.completionServerHint')}</p>
          ) : (
            <ul className="list-unstyled mb-3">
              {missingProfilePieces.map((item) => (
                <li key={item.key} className="mb-2 d-flex align-items-start gap-2">
                  <span className="text-danger mt-1" aria-hidden>
                    ○
                  </span>
                  <div className="flex-grow-1 min-w-0">
                    <div className="small mb-1">{item.label}</div>
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-decoration-none"
                      onClick={() => setTab('basic')}
                    >
                      {t('profile.jumpToFix')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Button variant="primary" className="w-100 rounded-pill" onClick={() => setTab('basic')}>
            {t('profile.completeProfileCta')}
          </Button>
        </div>
      )}
    </div>
  );

  if (showTabs) {
    return (
      <div className="tp-profile-editor-tabs d-flex flex-column h-100 min-h-0">
        <ul className="nav nav-tabs flex-shrink-0 px-2 pt-2 tp-profile-editor-tabs__nav">
          {tabBtn('basic', t('profile.basicInfo'))}
          {tabBtn('role', t('profile.roleInfo'))}
          {tabBtn('rate', t('profile.rateUsers'))}
          {tabBtn('reviews', t('profile.reviewsTab'))}
          {tabBtn('status', t('profile.profileStatus'))}
        </ul>
        <div className="tp-profile-editor-tabs__pane flex-grow-1 px-3 py-2 min-h-0 d-flex flex-column">
          <div className="tp-profile-sheet-pane-inner w-100 flex-grow-1 min-h-0 d-flex flex-column">
            {tab === 'basic' && basicTabContent}
            {tab === 'role' && rolePane}
            {tab === 'rate' && <ProfileRateUsersPanel />}
            {tab === 'reviews' && <ProfileReviewsPanel />}
            {tab === 'status' && statusPane}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-3">
      <div className="row g-3">
        <div className="col-md-4">
          <label className="form-label small fw-semibold text-body">
            {t('auth.fullName')} ({t('profile.displayPicture')})
          </label>
          {photoBlock}
          <label className="form-label small fw-semibold text-body">
            {t('auth.fullName')} ({t('profile.fullNamePhoto')})
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="form-control form-control-sm"
            onChange={(e) => setFiles((p) => ({ ...p, profile_image: e.target.files?.[0] || null }))}
          />
          <div className="mt-3">
            <label className="form-label small fw-semibold text-body">{t('profile.cnicFrontLabel')}</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="form-control form-control-sm"
              onChange={(e) => setFiles((p) => ({ ...p, cnic_image: e.target.files?.[0] || null }))}
            />
            {cnicFrontUrl ? (
              <img
                src={cnicFrontUrl}
                alt=""
                className="mt-2"
                style={{ width: '100%', borderRadius: 12, border: '1px solid var(--pak-border)' }}
              />
            ) : null}
          </div>
          <div className="mt-3">
            <label className="form-label small fw-semibold text-body">{t('profile.cnicBackLabel')}</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="form-control form-control-sm"
              onChange={(e) => setFiles((p) => ({ ...p, cnic_image_back: e.target.files?.[0] || null }))}
            />
            {cnicBackUrl ? (
              <img
                src={cnicBackUrl}
                alt=""
                className="mt-2"
                style={{ width: '100%', borderRadius: 12, border: '1px solid var(--pak-border)' }}
              />
            ) : null}
          </div>
        </div>
        <div className="col-md-8">
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-body">{t('auth.fullName')}</label>
              <input
                name="full_name"
                className="form-control form-control-sm"
                value={form.full_name}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-body">{t('auth.email')}</label>
              <input className="form-control form-control-sm" value={form.email} disabled />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-body">{t('auth.mobile')}</label>
              <input name="phone" className="form-control form-control-sm" value={form.phone} onChange={handleChange} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-body">{t('auth.cnic')}</label>
              <input
                name="cnic_number"
                className={`form-control form-control-sm ${cnicValid ? '' : 'is-invalid'}`}
                value={form.cnic_number}
                onChange={handleChange}
                disabled={!canEditCnic}
                placeholder={t('auth.cnicPlaceholder')}
              />
              {!cnicValid ? <div className="invalid-feedback">{t('errors.cnicInvalid')}</div> : null}
            </div>
          </div>
        </div>
      </div>
      <div className="d-flex justify-content-end mt-3">
        <Button variant="primary" onClick={handleSave} disabled={loading}>
          {loading ? <Loader light size="sm" /> : t('common.save')}
        </Button>
      </div>
    </Card>
  );
};

export default ProfileEditor;
