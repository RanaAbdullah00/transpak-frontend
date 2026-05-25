import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import { notifyAuthError } from '../../utils/notifySystem.js';
import { getPortalContainer } from '../../utils/portalRoot.js';
import { lockOverlayScroll } from '../../utils/overlayScrollLock.js';

const RoleSelection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setActiveRole, roleSwitching } = useAuth();
  const { t } = useLanguage();

  const roles = useMemo(() => {
    if (!user) return [];
    return Array.isArray(user.roles) && user.roles.length
      ? user.roles
      : [user.activeRole].filter(Boolean);
  }, [user]);

  const hasShipper = roles.includes('shipper');
  const hasCarrier = roles.includes('carrier');
  const dualRole = hasShipper && hasCarrier;

  const activeRole = user?.activeRole ?? user?.roles?.[0] ?? null;
  const targetRole = useMemo(() => {
    if (!dualRole) return null;
    if (activeRole === 'shipper' && hasCarrier) return 'carrier';
    if (activeRole === 'carrier' && hasShipper) return 'shipper';
    return hasShipper ? 'shipper' : hasCarrier ? 'carrier' : null;
  }, [dualRole, activeRole, hasShipper, hasCarrier]);

  const [switching, setSwitching] = useState(false);
  const [closing, setClosing] = useState(false);

  const returnPath = useMemo(() => {
    const from = location.state?.from;
    const fallbackDash = dashboardPathForRole(user?.activeRole ?? roles[0] ?? 'shipper');
    if (typeof from === 'string' && from.startsWith('/') && from !== '/role') {
      if (from === '/' && user) return fallbackDash;
      return from;
    }
    return fallbackDash;
  }, [location.state, user, roles]);

  const runClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      navigate(returnPath, { replace: true });
    }, 320);
  }, [navigate, returnPath]);

  useEffect(() => {
    if (!user) return;
    if (roles.length === 0) {
      navigate('/register', {
        replace: true,
        state: {
          prefill: {
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || '',
            cnic: user.cnic || ''
          }
        }
      });
      return;
    }
    if (roles.length === 1) {
      navigate(dashboardPathForRole(roles[0]), { replace: true });
      return;
    }
    if (!dualRole) {
      const ar = user.activeRole ?? roles[0];
      if (ar) navigate(dashboardPathForRole(ar), { replace: true });
    }
  }, [user, roles, navigate, dualRole]);

  useEffect(() => {
    if (!user || !dualRole) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') runClose();
    };
    window.addEventListener('keydown', onKey);
    const unlockScroll = lockOverlayScroll();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, [user, dualRole, runClose]);

  if (!user) return null;
  if (!roles.length) return null;
  if (!dualRole && roles.length === 1) return null;
  if (!dualRole) return null;

  const handleSwitch = async () => {
    if (!targetRole || roleSwitching) return;
    setSwitching(true);
    try {
      if (roles.includes(targetRole)) {
        await setActiveRole(targetRole);
        navigate(dashboardPathForRole(targetRole), { replace: true });
      } else {
        navigate('/register', {
          replace: true,
          state: {
            upgradeRole: targetRole,
            prefill: {
              name: user.name || '',
              email: user.email || '',
              phone: user.phone || '',
              cnic: user.cnic || ''
            }
          }
        });
      }
    } catch (err) {
      notifyAuthError(err, t, 'login');
    } finally {
      setSwitching(false);
    }
  };

  const portalHost = getPortalContainer();
  if (!portalHost) return null;

  return createPortal(
    <div
      className={`tp-ios-sheet-backdrop ${closing ? 'tp-ios-sheet-backdrop--out' : ''}`}
      role="presentation"
      onClick={runClose}
      aria-hidden={false}
    >
      <div
        className={`tp-ios-sheet-panel tp-ios-sheet-panel--role ${closing ? 'tp-ios-sheet-panel--out' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-role-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tp-ios-sheet-grabber-wrap" aria-hidden="true">
          <span className="tp-ios-sheet-grabber d-block" />
        </div>
        <div className="tp-ios-sheet-header d-flex align-items-center justify-content-between px-3 pb-2">
          <span id="tp-role-sheet-title" className="fw-semibold text-body small">
            {t('pages.roleSheet.title')}
          </span>
          <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-2" onClick={runClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <div className="tp-ios-sheet-body tp-role-sheet-scroll px-3 pb-3">
          <p className="small tp-secondary-text mb-3">{t('pages.roleSheet.body')}</p>
          <Button variant="primary" className="w-100 py-2 rounded-pill fw-semibold" onClick={handleSwitch} disabled={switching}>
            {switching ? <Loader light size="sm" /> : t('nav.switchAccount')}
          </Button>
          <button type="button" className="btn btn-link btn-sm w-100 tp-secondary-text mt-2" onClick={runClose}>
            {t('pages.roleSheet.dismiss')}
          </button>
        </div>
      </div>
    </div>,
    portalHost
  );
};

export default RoleSelection;
