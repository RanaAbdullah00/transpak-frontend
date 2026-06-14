import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  FaHome,
  FaListUl,
  FaTruck,
  FaTools,
  FaUserShield,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaBell
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';

const mobileNavClass = ({ isActive }) =>
  `nav-link d-flex flex-column align-items-center small rounded-0 py-2 ${isActive ? 'mobile-nav-active' : ''}`;

const MobileNav = () => {
  const { user } = useAuth();
  const { t, isUrdu } = useLanguage();

  const activeRole = user?.activeRole ?? user?.roles?.[0];

  if (activeRole === 'admin') {
    return (
      <nav className={`mobile-bottom-nav d-md-none tp-admin-mobile-nav ${isUrdu ? 'tp-rtl' : ''}`}>
        <div className="nav nav-pills border-top mobile-nav-inner tp-admin-mobile-nav__scroll">
          <NavLink to="/admin/dashboard" className={mobileNavClass} end>
            <FaHome />
            <span>{t('nav.adminDashboard')}</span>
          </NavLink>
          <NavLink to="/admin/fleet" className={mobileNavClass}>
            <FaTruck />
            <span>{t('nav.fleetApproval')}</span>
          </NavLink>
          <NavLink to="/admin/loads" className={mobileNavClass}>
            <FaListUl />
            <span>{t('nav.adminModeration')}</span>
          </NavLink>
          <NavLink to="/admin/disputes" className={mobileNavClass}>
            <FaExclamationTriangle />
            <span>{t('nav.disputes')}</span>
          </NavLink>
          <NavLink to="/admin/notifications" className={mobileNavClass}>
            <FaBell />
            <span>{t('nav.notifications')}</span>
          </NavLink>
        </div>
      </nav>
    );
  }

  const dashboardPath =
    activeRole === 'carrier' ? '/dashboard/carrier' : '/dashboard/shipper';

  const roleSlot =
    activeRole === 'carrier'
      ? { to: '/carrier/truck-details', icon: <FaTools />, label: t('nav.truckDetails') }
      : { to: '/loads/manage', icon: <FaTools />, label: t('common.manage') };

  const loadsPath =
    activeRole === 'carrier' ? '/loads/manage?tab=marketplace&sub=loads' : '/loads/manage';
  const bidsPath = activeRole === 'carrier' ? '/bids/mine' : '/bids';

  return (
    <nav className={`mobile-bottom-nav d-md-none ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="nav nav-pills nav-fill border-top mobile-nav-inner">
        <NavLink to={dashboardPath} className={mobileNavClass} end>
          <FaHome />
          <span>{t('common.home')}</span>
        </NavLink>
        <NavLink to={loadsPath} className={mobileNavClass} end={loadsPath === '/loads'}>
          <FaListUl />
          <span>{t('common.loads')}</span>
        </NavLink>
        <NavLink to={bidsPath} className={mobileNavClass} end>
          <FaClipboardCheck />
          <span>{t('pages.bids.management')}</span>
        </NavLink>
        <NavLink to={roleSlot.to} className={mobileNavClass}>
          {roleSlot.icon}
          <span>{roleSlot.label}</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default MobileNav;
