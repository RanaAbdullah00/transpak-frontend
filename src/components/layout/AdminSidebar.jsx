import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaUserShield,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaListUl,
  FaFileAlt,
  FaBell,
  FaUserTag,
  FaShippingFast,
  FaCog,
  FaSignOutAlt
} from 'react-icons/fa';
import { useLanguage } from '../../hooks/useLanguage.js';
import SafeAvatar from '../ui/SafeAvatar.jsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import LogoutConfirmModal from '../ui/LogoutConfirmModal.jsx';
import ActiveRoleBadge from '../profile/ActiveRoleBadge.jsx';
import { resolveWorkspaceSwitchTarget } from '../../utils/roleSwitch.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import { notifyError } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';

const navLinkClass = ({ isActive }) =>
  `nav-link d-flex align-items-center gap-2 rounded-lg px-3 py-2 mb-1 ${isActive ? 'active' : ''}`;

/** Platform admin navigation only — no shipper/carrier commercial links. */
const AdminSidebar = () => {
  const navigate = useNavigate();
  const { user, setActiveRole, roleSwitching } = useAuth();
  const { t } = useLanguage();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const workspaceTarget = resolveWorkspaceSwitchTarget(user);

  const handleWorkspaceSwitch = async () => {
    if (!workspaceTarget || roleSwitching) return;
    try {
      await setActiveRole(workspaceTarget);
      navigate(dashboardPathForRole(workspaceTarget), { replace: true });
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('errors.generic') }));
    }
  };

  return (
    <aside className="d-none d-md-block sidebar-fixed sidebar-aside d-flex flex-column tp-admin-sidebar">
      <div className="px-3 pt-3 pb-2 border-bottom tp-border-theme">
        <div className="small text-muted text-uppercase fw-semibold tp-admin-sidebar__label">
          {t('nav.adminConsole')}
        </div>
      </div>
      <nav className="nav flex-column p-3 small flex-grow-1 overflow-auto tp-sidebar-nav">
        <NavLink to="/admin/dashboard" className={navLinkClass} end>
          <FaTachometerAlt />
          {t('nav.adminDashboard')}
        </NavLink>
        <NavLink to="/admin/users" className={navLinkClass}>
          <FaUserShield />
          {t('nav.adminUsers')}
        </NavLink>
        <NavLink to="/admin/verification" className={navLinkClass}>
          <FaClipboardCheck />
          {t('nav.verification')}
        </NavLink>
        <NavLink to="/admin/disputes" className={navLinkClass}>
          <FaExclamationTriangle />
          {t('nav.disputes')}
        </NavLink>
        <NavLink to="/admin/loads" className={navLinkClass}>
          <FaListUl />
          {t('nav.adminModeration')}
        </NavLink>
        <NavLink to="/admin/shipments" className={navLinkClass}>
          <FaShippingFast />
          {t('nav.shipments')}
        </NavLink>
        <NavLink to="/admin/otp-logs" className={navLinkClass}>
          <FaFileAlt />
          {t('nav.adminReports')}
        </NavLink>
        <NavLink to="/admin/notifications" className={navLinkClass}>
          <FaBell />
          {t('pages.admin.notificationsTitle')}
        </NavLink>
        <NavLink to="/admin/roles" className={navLinkClass}>
          <FaUserTag />
          {t('nav.roleManagement')}
        </NavLink>
        <NavLink to="/settings" className={navLinkClass}>
          <FaCog />
          {t('nav.settings')}
        </NavLink>
        {workspaceTarget ? (
          <button
            type="button"
            className="nav-link d-flex align-items-center gap-2 rounded-lg px-3 py-2 mb-1 w-100 border-0 bg-transparent text-start"
            onClick={handleWorkspaceSwitch}
            disabled={roleSwitching}
          >
            {workspaceTarget === 'shipper' ? t('auth.shipper') : t('auth.carrier')}
          </button>
        ) : null}
      </nav>
      <div className="border-top flex-shrink-0 tp-sidebar-footer tp-border-theme">
        <div className="p-3 pb-2">
          {user && (
            <div className="d-flex align-items-center gap-2 px-2 py-2">
              <div className="tp-avatar-36 tp-border-theme rounded-circle overflow-hidden border flex-shrink-0">
                <SafeAvatar
                  src={user.profileImage}
                  name={user.fullName || user.name}
                  email={user.email}
                  fallbackClassName="w-100 h-100 d-flex align-items-center justify-content-center tp-sidebar-avatar-placeholder fw-semibold tp-badge-sm"
                />
              </div>
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold text-truncate small">{user.name || t('common.userFallback')}</div>
                <ActiveRoleBadge className="mt-1" />
              </div>
            </div>
          )}
        </div>
        <div className="px-3 pb-3">
          <button
            type="button"
            className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2 rounded-lg py-2"
            onClick={() => setShowLogoutModal(true)}
          >
            <FaSignOutAlt size={14} />
            {t('nav.logout')}
          </button>
        </div>
      </div>
      <LogoutConfirmModal show={showLogoutModal} onClose={() => setShowLogoutModal(false)} />
    </aside>
  );
};

export default AdminSidebar;
