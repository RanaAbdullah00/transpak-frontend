import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage.js';
import SafeAvatar from '../ui/SafeAvatar.jsx';

/**
 * Link to public trust profile `/profile/u/:id`
 */
const ProfileLink = ({
  userId,
  name,
  avatarSrc,
  showAvatar = false,
  className = '',
  showBadge = false,
  role
}) => {
  const { t } = useLanguage();
  if (!userId) return <span className={className}>{name || t('common.userFallback')}</span>;

  return (
    <Link
      to={`/profile/u/${encodeURIComponent(userId)}`}
      className={`tp-profile-link d-inline-flex align-items-center gap-2 ${className}`.trim()}
    >
      {showAvatar ? (
        <span className="tp-avatar-sm rounded-circle overflow-hidden border flex-shrink-0">
          <SafeAvatar src={avatarSrc} name={name} />
        </span>
      ) : null}
      <span className="tp-profile-link__name">{name || t('common.userFallback')}</span>
      {showBadge && role ? (
        <span className="tp-role-badge tp-profile-link__badge">{role}</span>
      ) : null}
    </Link>
  );
};

export default ProfileLink;
