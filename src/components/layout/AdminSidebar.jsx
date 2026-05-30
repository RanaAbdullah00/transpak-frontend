import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaTruck,
  FaExclamationTriangle,
  FaListUl,
  FaBell,
  FaUserTag,
  FaUsers,
  FaCog,
  FaSignOutAlt,
  FaGavel
} from 'react-icons/fa';
import { useLanguage } from '../../hooks/useLanguage.js';
import SafeAvatar from '../ui/SafeAvatar.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import LogoutConfirmModal from '../ui/LogoutConfirmModal.jsx';

const navLinkClass = ({ isActive }) =>
  `nav-link d-flex align-items-center gap-2 rounded-lg px-3 py-2 mb-1 ${isActive ? 'active' : ''}`;

/** Platform admin navigation only — no shipper/carrier commercial links. */
const AdminSidebar = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

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
          <FaUsers />
          {t('pages.admin.usersTitle')}
        </NavLink>
        <NavLink to="/admin/fleet" className={navLinkClass}>
          <FaTruck />
          {t('nav.fleetApproval')}
        </NavLink>
        <NavLink to="/admin/bids" className={navLinkClass}>
          <FaGavel />
          {t('pages.admin.bidsTitle')}
        </NavLink>
        <NavLink to="/admin/disputes" className={navLinkClass}>
          <FaExclamationTriangle />
          {t('nav.disputes')}
        </NavLink>
        <NavLink to="/admin/loads" className={navLinkClass}>
          <FaListUl />
          {t('nav.adminModeration')}
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
                <span className="badge bg-dark mt-1">{t('common.admin')}</span>
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
