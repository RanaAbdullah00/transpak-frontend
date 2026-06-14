import React from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { FaSignOutAlt, FaClipboardCheck } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth.js';
import LogoutConfirmModal from '../ui/LogoutConfirmModal.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { getPortalContainer } from '../../utils/portalRoot.js';

const linkClass = ({ isActive }) =>
  `list-group-item list-group-item-action border-0 rounded-lg mb-1 ${isActive ? 'active' : ''}`;

const MobileDrawer = ({ open, onClose }) => {
  const { t, isUrdu } = useLanguage();
  const { user } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const activeRole = user?.activeRole ?? user?.roles?.[0];

  const dashboardPath =
    activeRole === 'carrier'
      ? '/dashboard/carrier'
      : activeRole === 'admin'
      ? '/admin/dashboard'
      : '/dashboard/shipper';

  const handleLogoutClick = () => {
    onClose();
    setShowLogoutModal(true);
  };

  if (!open) return null;

  const host = getPortalContainer();
  if (!host) return null;

  return createPortal(
    <>
      <div className="tp-drawer-backdrop tp-drawer-portal-host" onClick={onClose} role="button" tabIndex={0}>
        <aside
          className={`tp-drawer d-flex flex-column min-h-0 ${isUrdu ? 'tp-rtl' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="d-flex justify-content-between align-items-center mb-2 gap-2 flex-wrap">
            <div className="fw-bold mb-0">{t('nav.menu')}</div>
            <button type="button" className="btn btn-sm btn-outline-secondary rounded-lg" onClick={onClose}>
              {t('nav.close')}
            </button>
          </div>
          <div className="list-group list-group-flush flex-grow-1 overflow-auto tp-drawer-scroll min-h-0">
            <NavLink to={dashboardPath} className={linkClass} onClick={onClose} end>
              {t('nav.dashboard')}
            </NavLink>
            {activeRole === 'shipper' && (
              <>
                <NavLink to="/loads/post" className={linkClass} onClick={onClose}>
                  {t('nav.postLoad')}
                </NavLink>
                <NavLink to="/loads/manage" className={linkClass} onClick={onClose}>
                  {t('nav.manageLoads')}
                </NavLink>
                <NavLink to="/bids" className={linkClass} onClick={onClose} end>
                  {t('nav.bids')}
                </NavLink>
              </>
            )}
            {(activeRole === 'shipper' || activeRole === 'carrier') && (
              <>
                <NavLink to="/shipments/active" className={linkClass} onClick={onClose}>
                  {t('nav.shipmentsActive')}
                </NavLink>
                <NavLink to="/shipments/history" className={linkClass} onClick={onClose}>
                  {t('nav.shipmentsHistory')}
                </NavLink>
                {activeRole === 'shipper' ? (
                  <NavLink to="/shipments/tracking" className={linkClass} onClick={onClose}>
                    {t('nav.shipmentsTracking')}
                  </NavLink>
                ) : null}
              </>
            )}
            {activeRole === 'carrier' && (
              <>
                <NavLink to="/loads/manage?tab=marketplace&sub=loads" className={linkClass} onClick={onClose}>
                  {t('loadsHub.marketplaceTitle')}
                </NavLink>
                <NavLink to="/bids/mine" className={linkClass} onClick={onClose}>
                  {t('nav.myBids')}
                </NavLink>
                <NavLink to="/carrier/truck-details" className={linkClass} onClick={onClose}>
                  {t('nav.truckDetails')}
                </NavLink>
                <NavLink to="/carrier/verification" className={linkClass} onClick={onClose}>
                  <span className="d-flex align-items-center gap-2">
                    <FaClipboardCheck size={14} aria-hidden />
                    {t('nav.carrierVerification')}
                  </span>
                </NavLink>
              </>
            )}
            {activeRole === 'admin' && (
              <>
                <NavLink to="/admin/dashboard" className={linkClass} onClick={onClose}>
                  {t('nav.adminDashboard')}
                </NavLink>
                <NavLink to="/admin/fleet" className={linkClass} onClick={onClose}>
                  {t('nav.fleetApproval')}
                </NavLink>
                <NavLink to="/admin/bids" className={linkClass} onClick={onClose}>
                  {t('pages.admin.bidsTitle')}
                </NavLink>
                <NavLink to="/admin/disputes" className={linkClass} onClick={onClose}>
                  {t('nav.disputes')}
                </NavLink>
                <NavLink to="/admin/users" className={linkClass} onClick={onClose}>
                  {t('pages.admin.usersTitle')}
                </NavLink>
                <NavLink to="/admin/loads" className={linkClass} onClick={onClose}>
                  {t('nav.adminModeration')}
                </NavLink>
                <NavLink to="/admin/notifications" className={linkClass} onClick={onClose}>
                  {t('pages.admin.notificationsTitle')}
                </NavLink>
                <NavLink to="/admin/roles" className={linkClass} onClick={onClose}>
                  {t('nav.roleManagement')}
                </NavLink>
              </>
            )}
            <NavLink to="/settings" className={linkClass} onClick={onClose}>
              {t('nav.settings')}
            </NavLink>
            <NavLink to="/profile" className={linkClass} onClick={onClose}>
              {t('nav.profile')}
            </NavLink>
          </div>
          <div className="pt-3 mt-auto border-top flex-shrink-0" style={{ borderColor: 'var(--pak-border)' }}>
            <button
              type="button"
              className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2 rounded-lg py-2"
              onClick={handleLogoutClick}
            >
              <FaSignOutAlt />
              {t('nav.logout')}
            </button>
          </div>
        </aside>
      </div>
      <LogoutConfirmModal show={showLogoutModal} onClose={() => setShowLogoutModal(false)} />
    </>,
    host
  );
};

export default MobileDrawer;
