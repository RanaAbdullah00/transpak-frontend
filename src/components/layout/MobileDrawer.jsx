import React from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { FaSignOutAlt, FaClipboardCheck } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth.js';
import { AppContext } from '../../context/AppContext.jsx';
import LogoutConfirmModal from '../ui/LogoutConfirmModal.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { getPortalContainer } from '../../utils/portalRoot.js';

const linkClass = ({ isActive }) =>
  `list-group-item list-group-item-action border-0 rounded-lg mb-1 ${isActive ? 'active' : ''}`;

const MobileDrawer = ({ open, onClose }) => {
  const { t, isUrdu } = useLanguage();
  const { user } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const app = React.useContext(AppContext);
  const unreadCount = Array.isArray(app?.notifications) ? app.notifications.filter((n) => !n.read).length : 0;
  const activeRole = user?.activeRole ?? user?.roles?.[0];

  const dashboardPath =
    activeRole === 'carrier'
      ? '/dashboard/carrier'
      : activeRole === 'admin'
      ? '/dashboard/admin'
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
            <div className="fw-bold">{t('nav.menu')}</div>
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
            {activeRole === 'carrier' && (
              <>
                <NavLink to="/loads" className={linkClass} onClick={onClose}>
                  {t('nav.loads')}
                </NavLink>
                <NavLink to="/bids/mine" className={linkClass} onClick={onClose}>
                  {t('nav.myBids')}
                </NavLink>
                <NavLink to="/fleet" className={linkClass} onClick={onClose}>
                  {t('nav.fleet')}
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
                <NavLink to="/admin/roles" className={linkClass} onClick={onClose}>
                  {t('nav.roleManagement')}
                </NavLink>
                <NavLink to="/admin/verification" className={linkClass} onClick={onClose}>
                  {t('nav.verification')}
                </NavLink>
                <NavLink to="/admin/disputes" className={linkClass} onClick={onClose}>
                  {t('nav.disputes')}
                </NavLink>
                <NavLink to="/admin/shipments" className={linkClass} onClick={onClose}>
                  {t('nav.shipments')}
                </NavLink>
              </>
            )}
            <NavLink to="/notifications" className={linkClass} onClick={onClose}>
              <span className="d-flex align-items-center gap-2">
                {t('nav.notifications')}
                {unreadCount > 0 && <span className="badge bg-danger rounded-pill">{unreadCount}</span>}
              </span>
            </NavLink>
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
