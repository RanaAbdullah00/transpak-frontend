import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import { resolveCommercialSwitchTarget } from '../../utils/roleSwitch.js';
import { canAccessAdminRoutes } from '../../utils/authSession.js';
import { resolveAdminShell } from '../../utils/rbac.js';
import { useReceivedRatingSummary } from '../../hooks/useReceivedRatingSummary.js';
import { notifyError } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';

/**
 * Profile “trust center” role summary: active role, role chips, lightweight stats (existing APIs only).
 */
const ProfileRolePanel = () => {
  const { user, setActiveRole, roleSwitching } = useAuth();
  const { request } = useApi();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const hideForAdmin =
    resolveAdminShell(user, location.pathname) ||
    (canAccessAdminRoutes(user) && user?.activeRole === 'admin');
  const uid = user?.id || user?._id;
  const { avg, count } = useReceivedRatingSummary(uid);

  const roles = user?.roles?.length ? user.roles : [user?.activeRole].filter(Boolean);
  const activeRole = user?.activeRole ?? roles[0];
  const hasBothCommercial = roles.includes('shipper') && roles.includes('carrier');
  const hasShipper = roles.includes('shipper');
  const hasCarrier = roles.includes('carrier');
  const isAdminPlatformOnly = roles.includes('admin') && !hasShipper && !hasCarrier;

  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await request({ url: '/profile/activity-snapshot' });
        if (!cancelled) setSnapshot(data && typeof data === 'object' ? data : null);
      } catch (e) {
        if (!cancelled) {
          setSnapshot(null);
          notifyError(formatUserError(e, t, { fallback: t('profile.activitySnapshotFailed') }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request, t, user?.activeRole]);

  const roleLabel = (r) => {
    if (r === 'shipper') return t('auth.shipper');
    if (r === 'carrier') return t('auth.carrier');
    if (r === 'admin') return t('common.admin');
    return r || t('common.emDash');
  };

  const handleSwitchRole = async (targetRole) => {
    const target = targetRole || resolveCommercialSwitchTarget(user);
    if (!target || roleSwitching) return;
    try {
      await setActiveRole(target);
      navigate(dashboardPathForRole(target), { replace: true });
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('errors.generic') }));
    }
  };

  const trustLine =
    count > 0 && avg != null
      ? t('profile.trustScoreLine', { avg: avg.toFixed(1), count })
      : t('profile.trustScoreNone');

  const shipperBlock = snapshot?.shipper;
  const carrierBlock = snapshot?.carrier;
  const adminBlock = snapshot?.admin;

  const renderShipperStats = () => (
    <div className="row g-2 small">
      <div className="col-6">
        <div className="tp-secondary-text">{t('profile.statLoadsPosted')}</div>
        <div className="fw-semibold fs-6">{shipperBlock?.loadsTotal ?? 0}</div>
      </div>
      <div className="col-6">
        <div className="tp-secondary-text">{t('profile.statLoadsCompleted')}</div>
        <div className="fw-semibold fs-6">{shipperBlock?.loadsDone ?? 0}</div>
      </div>
    </div>
  );

  const renderCarrierStats = () => (
    <div className="row g-2 small">
      <div className="col-6">
        <div className="tp-secondary-text">{t('profile.statBidsPlaced')}</div>
        <div className="fw-semibold fs-6">{carrierBlock?.bidsTotal ?? 0}</div>
      </div>
      <div className="col-6">
        <div className="tp-secondary-text">{t('profile.statBidsAccepted')}</div>
        <div className="fw-semibold fs-6">{carrierBlock?.bidsAccepted ?? 0}</div>
      </div>
      <div className="col-12">
        <div className="tp-secondary-text">{t('profile.statFleetVehiclesShort')}</div>
        <div className="fw-semibold fs-6">{carrierBlock?.fleetCount ?? 0}</div>
      </div>
    </div>
  );

  const renderAdminStats = () => (
    <div className="row g-2 small">
      <div className="col-6">
        <div className="tp-secondary-text">{t('profile.statAdminUsers')}</div>
        <div className="fw-semibold fs-6">{adminBlock?.totalUsers ?? 0}</div>
      </div>
      <div className="col-6">
        <div className="tp-secondary-text">{t('profile.statAdminLoads')}</div>
        <div className="fw-semibold fs-6">{adminBlock?.totalLoads ?? 0}</div>
      </div>
      <div className="col-6">
        <div className="tp-secondary-text">{t('profile.statAdminBids')}</div>
        <div className="fw-semibold fs-6">{adminBlock?.totalBids ?? 0}</div>
      </div>
      <div className="col-6">
        <div className="tp-secondary-text">{t('profile.statAdminActiveShipments')}</div>
        <div className="fw-semibold fs-6">{adminBlock?.activeShipments ?? 0}</div>
      </div>
      <div className="col-12">
        <div className="tp-secondary-text">{t('profile.statAdminReviews')}</div>
        <div className="fw-semibold fs-6">{adminBlock?.totalReviews ?? 0}</div>
      </div>
    </div>
  );

  const renderCommercialSnapshot = () => {
    if (hasShipper && hasCarrier) {
      return (
        <div className="d-flex flex-column gap-3">
          <div>
            <div className="small fw-semibold mb-2 text-body">{t('profile.activityAsShipper')}</div>
            {renderShipperStats()}
          </div>
          <div className="border-top border-opacity-25 pt-2">
            <div className="small fw-semibold mb-2 text-body">{t('profile.activityAsCarrier')}</div>
            {renderCarrierStats()}
          </div>
        </div>
      );
    }
    if (hasShipper) return renderShipperStats();
    if (hasCarrier) return renderCarrierStats();
    return <p className="small tp-secondary-text mb-0">{t('profile.activityNoCommercialHint')}</p>;
  };

  if (hideForAdmin) return null;

  return (
    <div className="d-flex flex-column gap-3 tp-profile-role-panel">
      <div className="tp-profile-section rounded-4 p-3 border shadow-sm">
        <div className="small tp-secondary-text text-uppercase fw-semibold mb-2">
          {t('profile.activeWorkspace')}
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <span className="badge rounded-pill px-3 py-2 bg-primary tp-profile-active-role-badge">
            {roleLabel(activeRole)}
          </span>
          <span className="small tp-secondary-text">{t('profile.activeRoleHint')}</span>
        </div>
        <div className="small tp-secondary-text mb-1">{t('profile.rolesOnAccount')}</div>
        <div className="d-flex flex-wrap gap-2">
          {roles.map((r) => (
            <button
              key={r}
              type="button"
              className={`badge rounded-pill px-2 py-1 tp-profile-role-chip border-0 ${
                r === activeRole ? 'tp-profile-role-chip--active' : 'tp-profile-role-chip--idle'
              }`}
              disabled={roleSwitching || r === activeRole}
              onClick={() => handleSwitchRole(r)}
            >
              {roleLabel(r)}
            </button>
          ))}
        </div>
        {roles.length > 1 ? (
          <button
            type="button"
            className="btn btn-outline-primary btn-sm rounded-pill mt-3 w-100"
            onClick={() => handleSwitchRole()}
            disabled={roleSwitching || !resolveCommercialSwitchTarget(user)}
          >
            {t('profile.switchRoleVisualCta')}
          </button>
        ) : null}
        <p className="small tp-secondary-text mt-2 mb-0">{t('profile.switchRoleVisualHint')}</p>
      </div>

      <div className="tp-profile-section rounded-4 p-3 border shadow-sm">
        <div className="small tp-secondary-text text-uppercase fw-semibold mb-2">{t('profile.activitySnapshot')}</div>
        {isAdminPlatformOnly ? (
          <>
            <div className="small fw-semibold mb-2 text-body">{t('profile.activityAsAdmin')}</div>
            {adminBlock ? (
              renderAdminStats()
            ) : (
              <p className="small tp-secondary-text mb-0">{t('profile.activitySnapshotFailed')}</p>
            )}
          </>
        ) : (
          renderCommercialSnapshot()
        )}
      </div>

      <div className="tp-profile-section rounded-4 p-3 border shadow-sm">
        <div className="small tp-secondary-text text-uppercase fw-semibold mb-1">{t('profile.trustLayer')}</div>
        <p className="mb-0 small text-body">{trustLine}</p>
      </div>
    </div>
  );
};

export default ProfileRolePanel;
