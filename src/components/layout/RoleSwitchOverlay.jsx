import React from 'react';
import Loader from '../ui/Loader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';

/** Blocks interaction while commercial role switch completes. */
const RoleSwitchOverlay = () => {
  const { roleSwitching } = useAuth();
  const { t } = useLanguage();
  if (!roleSwitching) return null;
  return (
    <div className="tp-role-switch-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="tp-role-switch-overlay__card rounded-3 shadow">
        <Loader />
        <span className="small fw-semibold mt-2">{t('nav.switchAccount')}…</span>
      </div>
    </div>
  );
};

export default RoleSwitchOverlay;
