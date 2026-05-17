import React from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { translateRoleLabel } from '../../utils/i18nLabels.js';

/**
 * Shown when profile is complete — replaces "Complete profile" prompts.
 */
const ActiveRoleBadge = ({ className = '' }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const role = user?.activeRole ?? user?.roles?.[0];
  const complete = user?.profileComplete === true;

  if (!complete || !role) return null;

  const isShipper = role === 'shipper';
  const label = isShipper ? t('profile.activeShipperBadge') : t('profile.activeCarrierBadge');
  const roleLabel = translateRoleLabel(t, role);

  return (
    <span
      className={`tp-active-role-badge ${isShipper ? 'tp-active-role-badge--shipper' : 'tp-active-role-badge--carrier'} ${className}`.trim()}
      title={roleLabel}
    >
      <span className="tp-active-role-badge__dot" aria-hidden />
      {label}
    </span>
  );
};

export default ActiveRoleBadge;
