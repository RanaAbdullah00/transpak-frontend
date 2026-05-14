import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { FaBars, FaBell } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth.js';
import { AppContext } from '../../context/AppContext.jsx';
import MobileDrawer from './MobileDrawer.jsx';
import BrandLogo from './BrandLogo.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import { notifyError } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import api from '../../services/api.js';
import LanguageToggle from '../ui/LanguageToggle.jsx';

const Navbar = () => {
  const navigate = useNavigate();
  const { t, isUrdu } = useLanguage();
  const { user, setActiveRole } = useAuth();
  const app = React.useContext(AppContext);
  const [serverUnread, setServerUnread] = useState(0);
  const ephemeralUnread = Array.isArray(app?.notifications)
    ? app.notifications.filter((n) => !(n.read || n.isRead)).length
    : 0;
  const unreadCount = Math.max(serverUnread, ephemeralUnread);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setServerUnread(0);
        return;
      }
      try {
        const res = await api.get('/notifications/unread-count');
        const body = res.data;
        const n = typeof body?.count === 'number' ? body.count : 0;
        setServerUnread(n);
      } catch {
        setServerUnread(0);
      }
    };
    load();
    const onRead = () => load();
    window.addEventListener('tp_notifications_read', onRead);
    return () => window.removeEventListener('tp_notifications_read', onRead);
  }, [user]);
  const roles = user?.roles?.length ? user.roles : [user?.activeRole].filter(Boolean);
  const activeRole = user?.activeRole ?? roles[0];

  const hasShipper = roles.includes('shipper');
  const hasCarrier = roles.includes('carrier');
  const hasBothCommercial = hasShipper && hasCarrier;
  const hasOneCommercial = (hasShipper || hasCarrier) && !hasBothCommercial;
  const showCommercialRoleAction = hasShipper || hasCarrier;

  const missingCommercialRole = hasShipper && !hasCarrier ? 'carrier' : !hasShipper && hasCarrier ? 'shipper' : null;

  const navRoleActionLabel = hasBothCommercial ? t('nav.switchAccount') : t('nav.addProfile');

  const handleNavRoleAction = () => {
    if (!user || !showCommercialRoleAction) return;

    const originalRole = activeRole;

    if (hasBothCommercial) {
      const targetRole = activeRole === 'shipper' ? 'carrier' : activeRole === 'carrier' ? 'shipper' : null;
      if (!targetRole || !roles.includes(targetRole)) return;
      setActiveRole(targetRole).catch((err) => {
        notifyError(formatUserError(err, t, { fallback: t('errors.generic') }));
        if (originalRole) navigate(dashboardPathForRole(originalRole), { replace: true });
      });
      navigate(dashboardPathForRole(targetRole), { replace: true });
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
          <Link to="/" className="navbar-brand fw-bold mb-0">
            <BrandLogo variant="mark" title={t('common.appName')} />
          </Link>
          <div className="d-flex align-items-center gap-2">
            <LanguageToggle className="rounded-lg" />
            {user && (
              <>
                <NavLink
                  to="/notifications"
                  className="btn btn-outline-secondary btn-sm rounded-lg position-relative d-flex align-items-center justify-content-center"
                  aria-label={t('nav.notificationsAria')}
                >
                  <FaBell size={14} />
                  {unreadCount > 0 && (
                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: 9 }}>
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
                {showCommercialRoleAction && (
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm rounded-lg px-2 text-nowrap"
                    onClick={handleNavRoleAction}
                    title={navRoleActionLabel}
                  >
                    {navRoleActionLabel}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </nav>
      <nav
        className={`navbar navbar-expand-md navbar-light shadow-sm sticky-top d-none d-md-flex navbar-custom tp-navbar-surface ${isUrdu ? 'tp-rtl' : ''}`}
      >
        <div className="container-fluid px-3">
          <Link to="/" className="navbar-brand d-flex align-items-center fw-bold">
            <BrandLogo title={t('common.appName')} />
          </Link>

          <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
            <LanguageToggle className="rounded-lg" />
            {user ? (
              <>
                <NavLink
                  to="/notifications"
                  className="btn btn-outline-secondary btn-sm rounded-lg position-relative d-flex align-items-center gap-1"
                  aria-label={t('nav.notificationsAria')}
                >
                  <FaBell size={14} />
                  {unreadCount > 0 && (
                    <span className="badge rounded-pill bg-danger" style={{ fontSize: 9 }}>{unreadCount}</span>
                  )}
                </NavLink>
                {showCommercialRoleAction && (
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm rounded-lg px-3"
                    onClick={handleNavRoleAction}
                    title={navRoleActionLabel}
                  >
                    {navRoleActionLabel}
                  </button>
                )}
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-primary btn-sm px-3 rounded-lg">
                  {t('nav.login')}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default Navbar;
