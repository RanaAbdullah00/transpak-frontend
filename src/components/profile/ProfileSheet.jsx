import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage.js';
import { getPortalContainer } from '../../utils/portalRoot.js';
import { lockOverlayScroll } from '../../utils/overlayScrollLock.js';
import ProfileEditor from './ProfileEditor.jsx';

/**
 * iOS-style profile bottom sheet: ~50% height, expandable, swipe down + overlay + ESC to close.
 */
const ProfileSheet = ({ open, onClose }) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(true);
  const [closing, setClosing] = useState(false);
  const touchStartY = useRef(null);
  const panelRef = useRef(null);

  const runClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      onClose?.();
    }, 320);
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setClosing(false);
      return;
    }
    setClosing(false);
    setExpanded(true);
    const onKey = (e) => {
      if (e.key === 'Escape') runClose();
    };
    window.addEventListener('keydown', onKey);
    const unlockScroll = lockOverlayScroll();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, [open, runClose]);

  const onHandleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const onHandleTouchEnd = (e) => {
    if (touchStartY.current == null) return;
    const y = e.changedTouches[0].clientY;
    const dy = y - touchStartY.current;
    touchStartY.current = null;
    if (dy > 72) runClose();
    else if (dy < -48) setExpanded(true);
  };

  const toggleExpand = () => setExpanded((v) => !v);

  if (!open) return null;

  const portalHost = getPortalContainer();
  if (!portalHost) return null;

  return createPortal(
    <div
      key="tp-profile-sheet-root"
      className={`tp-ios-sheet-backdrop ${closing ? 'tp-ios-sheet-backdrop--out' : ''}`}
      role="presentation"
      onClick={runClose}
      aria-hidden={!open}
    >
      <div
        ref={panelRef}
        className={`tp-ios-sheet-panel ${expanded ? 'tp-ios-sheet-panel--expanded' : ''} ${closing ? 'tp-ios-sheet-panel--out' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('common.profile')}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="tp-ios-sheet-grabber-wrap"
          onTouchStart={onHandleTouchStart}
          onTouchEnd={onHandleTouchEnd}
        >
          <button
            type="button"
            className="tp-ios-sheet-grabber"
            aria-label={expanded ? t('profile.collapseSheet') : t('profile.expandSheet')}
            onClick={toggleExpand}
          />
        </div>
        <div className="tp-ios-sheet-header d-flex align-items-center justify-content-between px-3 pb-2">
          <span className="fw-semibold text-body small">{t('common.profile')}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-pill px-2"
            onClick={runClose}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>
        <div className="tp-ios-sheet-body">
          <ProfileEditor showTabs onSaved={() => {}} />
        </div>
      </div>
    </div>,
    portalHost
  );
};

/** Sidebar-owned sheet: hidden on /profile route (that page mounts its own sheet). */
export function SidebarProfileSheet({ open, onClose }) {
  const location = useLocation();
  if (location.pathname === '/profile') return null;
  return <ProfileSheet open={open} onClose={onClose} />;
}

export default ProfileSheet;
