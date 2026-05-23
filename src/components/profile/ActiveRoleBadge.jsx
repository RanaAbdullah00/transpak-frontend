import React from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { translateRoleLabel } from '../../utils/i18nLabels.js';

/**
 * Shown when profile is complete — replaces "Complete profile" prompts.
 */
const ActiveRoleBadge = ({ className = '', alwaysShow = false }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const role = user?.activeRole ?? user?.roles?.[0];
  const complete = user?.profileComplete === true;

  if (!role) return null;
  if (!alwaysShow && !complete && role !== 'admin') return null;

  const isShipper = role === 'shipper';
  const isAdmin = role === 'admin';
  const label = isAdmin
    ? t('profile.activeAdminBadge')
    : isShipper
      ? t('profile.activeShipperBadge')
      : t('profile.activeCarrierBadge');
  const roleLabel = translateRoleLabel(t, role);
  const tone = isAdmin ? 'admin' : isShipper ? 'shipper' : 'carrier';

  return (
    <span
      className={`tp-active-role-badge tp-active-role-badge--${tone} ${className}`.trim()}
      title={roleLabel}
    >
      <span className="tp-active-role-badge__dot" aria-hidden />
      {label}
    </span>
  );
};

export default ActiveRoleBadge;
