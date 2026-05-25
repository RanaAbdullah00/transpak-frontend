import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth.js';
import MobileDrawer from './MobileDrawer.jsx';
import BrandLogo from './BrandLogo.jsx';
import NotificationDropdown from '../notifications/NotificationDropdown.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import { resolveWorkspaceSwitchTarget } from '../../utils/roleSwitch.js';
import { notifyError } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import LanguageToggle from '../ui/LanguageToggle.jsx';
import ActiveRoleBadge from '../profile/ActiveRoleBadge.jsx';

const Navbar = () => {
  const navigate = useNavigate();
  const { t, isUrdu } = useLanguage();
  const { user, setActiveRole, roleSwitching } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const roles = user?.roles?.length ? user.roles : [user?.activeRole].filter(Boolean);
  const activeRole = user?.activeRole ?? roles[0];

  const hasShipper = roles.includes('shipper');
  const hasCarrier = roles.includes('carrier');
  const hasBothCommercial = hasShipper && hasCarrier;
  const hasOneCommercial = (hasShipper || hasCarrier) && !hasBothCommercial;
  const workspaceTarget = resolveWorkspaceSwitchTarget(user);
  const showWorkspaceSwitch = Boolean(workspaceTarget);

  const missingCommercialRole = hasShipper && !hasCarrier ? 'carrier' : !hasShipper && hasCarrier ? 'shipper' : null;

  const navRoleActionLabel =
    workspaceTarget === 'admin'
      ? t('nav.adminConsole')
      : activeRole === 'admin'
        ? workspaceTarget === 'shipper'
          ? t('auth.shipper')
          : t('auth.carrier')
        : hasBothCommercial
          ? t('nav.switchAccount')
          : t('nav.addProfile');

  const handleNavRoleAction = async () => {
    if (!user || !showWorkspaceSwitch || roleSwitching) return;

    const originalRole = activeRole;

    if (workspaceTarget) {
      try {
        await setActiveRole(workspaceTarget);
        navigate(dashboardPathForRole(workspaceTarget), { replace: true });
      } catch (err) {
        notifyError(formatUserError(err, t, { fallback: t('errors.generic') }));
        if (originalRole) navigate(dashboardPathForRole(originalRole), { replace: true });
      }
      return;
    }

    if (hasOneCommercial && missingCommercialRole) {
      navigate('/register', {
        replace: true,
        state: {
          upgradeRole: missingCommercialRole,
          prefill: {
            name: user?.fullName || user?.name || '',
            email: user?.email || '',
            phone: user?.phone || '',
            cnic: user?.cnicNumber || user?.cnic || ''
          }
        }
      });
    }
  };

  const roleActionBtn = showWorkspaceSwitch ? (
    <button
      type="button"
      className="btn btn-outline-success btn-sm rounded-lg px-2 text-nowrap d-none d-md-inline-flex px-3"
      onClick={handleNavRoleAction}
      title={navRoleActionLabel}
      disabled={roleSwitching}
    >
      {roleSwitching ? '…' : navRoleActionLabel}
    </button>
  ) : null;

  const roleActionBtnMobile = showWorkspaceSwitch ? (
    <button
      type="button"
      className="btn btn-outline-success btn-sm rounded-lg px-2 text-nowrap d-md-none"
      onClick={handleNavRoleAction}
      title={navRoleActionLabel}
      disabled={roleSwitching}
    >
      {roleSwitching ? '…' : navRoleActionLabel}
    </button>
  ) : null;

  return (
    <>
      <nav
        className={`navbar navbar-light shadow-sm sticky-top d-flex d-md-none navbar-custom tp-navbar-surface ${isUrdu ? 'tp-rtl' : ''}`}
      >
        <div className="container-fluid px-3 d-flex justify-content-between align-items-center">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm rounded-lg"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('nav.openMenu')}
          >
            <FaBars />
          </button>
          <Link to="/" className="navbar-brand fw-bold mb-0 d-flex align-items-center gap-2">
            <BrandLogo variant="mark" title={t('common.appName')} />
            {user && <ActiveRoleBadge alwaysShow className="tp-active-role-badge--compact" />}
          </Link>
          <div className="d-flex align-items-center gap-2">
            <LanguageToggle className="rounded-lg" />
            {user && (
              <>
                <NotificationDropdown />
                {roleActionBtnMobile}
              </>
            )}
          </div>
        </div>
      </nav>
      <nav
        className={`navbar navbar-expand-md navbar-light shadow-sm sticky-top d-none d-md-flex navbar-custom tp-navbar-surface ${isUrdu ? 'tp-rtl' : ''}`}
      >
        <div className="container-fluid px-3">
          <Link to="/" className="navbar-brand d-flex align-items-center gap-2 fw-bold">
            <BrandLogo variant="mark" title={t('common.appName')} />
            {user && <ActiveRoleBadge alwaysShow className="tp-active-role-badge--compact" />}
          </Link>

          <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
            <LanguageToggle className="rounded-lg" />
            {user ? (
              <>
                <NotificationDropdown />
                {roleActionBtn}
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm px-3 rounded-lg">
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      </nav>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default Navbar;
