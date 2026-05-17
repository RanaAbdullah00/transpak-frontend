import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage.js';

/**
 * Link to public trust profile `/profile/u/:id`
 */
const ProfileLink = ({ userId, name, className = '', showBadge = false, role }) => {
  const { t } = useLanguage();
  if (!userId) return <span className={className}>{name || t('common.userFallback')}</span>;

  return (
    <Link to={`/profile/u/${encodeURIComponent(userId)}`} className={`tp-profile-link ${className}`.trim()}>
      <span className="tp-profile-link__name">{name || t('common.userFallback')}</span>
      {showBadge && role ? (
        <span className="tp-role-badge tp-profile-link__badge">{role}</span>
      ) : null}
    </Link>
  );
};

export default ProfileLink;
