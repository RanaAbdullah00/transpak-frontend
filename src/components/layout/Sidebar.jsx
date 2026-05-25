import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaPlusCircle,
  FaTruck,
  FaListUl,
  FaGavel,
  FaCheckCircle,
  FaShippingFast,
  FaHistory,
  FaCog,
  FaSignOutAlt,
  FaQuestionCircle,
  FaClipboardCheck
} from 'react-icons/fa';
import { useLanguage } from '../../hooks/useLanguage.js';
import SafeAvatar from '../ui/SafeAvatar.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import LogoutConfirmModal from '../ui/LogoutConfirmModal.jsx';
import { SidebarProfileSheet } from '../profile/ProfileSheet.jsx';
import ActiveRoleBadge from '../profile/ActiveRoleBadge.jsx';

const navLinkClass = ({ isActive }) =>
  `nav-link d-flex align-items-center gap-2 rounded-lg px-3 py-2 mb-1 ${isActive ? 'active' : ''}`;

const Sidebar = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = React.useState(false);

  const activeRole = user?.activeRole ?? user?.roles?.[0];
  const isCarrier = activeRole === 'carrier';
  const isShipper = activeRole === 'shipper';

  const dashboardPath = isShipper ? '/dashboard/shipper' : '/dashboard/carrier';

  return (
    <aside className="d-none d-md-block sidebar-fixed sidebar-aside d-flex flex-column">
      <nav className="nav flex-column p-3 small flex-grow-1 overflow-auto tp-sidebar-nav">
        <NavLink to={dashboardPath} className={navLinkClass} end>
          <FaTachometerAlt />
          {t('common.dashboard')}
        </NavLink>
        {isShipper && (
          <>
            <NavLink to="/loads/post" className={navLinkClass}>
              <FaPlusCircle />
              {t('pages.loads.postLoad')}
            </NavLink>
            <NavLink to="/loads/manage" className={navLinkClass}>
              <FaListUl />
              {t('pages.loads.manageLoads')}
            </NavLink>
            <NavLink to="/bids" className={navLinkClass} end>
              <FaGavel />
              {t('pages.bids.management')}
            </NavLink>
            <NavLink to="/bids/approve" className={navLinkClass}>
              <FaCheckCircle />
              {t('pages.bids.approveCarrier')}
            </NavLink>
            <NavLink to="/shipments/tracking" className={navLinkClass}>
              <FaShippingFast />
              {t('pages.shipments.tracking')}
            </NavLink>
            <NavLink to="/shipments/history" className={navLinkClass}>
              <FaHistory />
              {t('pages.shipments.history')}
            </NavLink>
          </>
        )}
        {isCarrier && (
          <>
            <NavLink to="/loads" className={navLinkClass}>
              <FaListUl />
              {t('loadsHub.navOperations')}
            </NavLink>
            <NavLink to="/bids/mine" className={navLinkClass}>
              <FaGavel />
              {t('pages.bids.management')}
            </NavLink>
            <NavLink to="/fleet" className={navLinkClass}>
              <FaTruck />
              {t('common.fleet')}
            </NavLink>
            <NavLink to="/carrier/truck-details" className={navLinkClass}>
              <FaTruck />
              {t('nav.truckDetails')}
            </NavLink>
            <NavLink to="/carrier/verification" className={navLinkClass}>
              <FaClipboardCheck />
              {t('nav.carrierVerification')}
            </NavLink>
            <NavLink to="/shipments/tracking" className={navLinkClass}>
              <FaShippingFast />
              {t('pages.shipments.tracking')}
            </NavLink>
            <NavLink to="/shipments/history" className={navLinkClass}>
              <FaHistory />
              {t('pages.shipments.history')}
            </NavLink>
          </>
        )}
        <NavLink to="/support" className={navLinkClass}>
            <FaQuestionCircle />
            {t('common.support')}
          </NavLink>
        <NavLink to="/settings" className={navLinkClass}>
          <FaCog />
          {t('nav.settings')}
        </NavLink>
      </nav>
      <div className="border-top flex-shrink-0 tp-sidebar-footer tp-border-theme">
        <div className="p-3 pb-2">
          {user && (
            <button
              type="button"
              className="d-flex align-items-center gap-2 px-2 text-start text-decoration-none rounded-3 py-2 border-0 bg-transparent w-100 tp-sidebar-profile-trigger"
              title={t('common.profile')}
              onClick={() => {
                if (location.pathname === '/profile') return;
                setProfileSheetOpen(true);
              }}
            >
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
                {user.profileComplete ? (
                  <ActiveRoleBadge className="mt-1" />
                ) : (
                  <span className="badge bg-danger tp-badge-xs">{t('nav.profileIncompleteBadge')}</span>
                )}
              </div>
            </button>
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
      <SidebarProfileSheet open={profileSheetOpen} onClose={() => setProfileSheetOpen(false)} />
    </aside>
  );
};

export default Sidebar;

