import React from 'react';
import ProfileLink from './ProfileLink.jsx';

/**
 * Global profile access — avatar + link to /profile/u/:id everywhere.
 */
const ProfileAccessLayer = ({
  userId,
  name,
  avatarSrc,
  showAvatar = true,
  className = '',
  showBadge = false,
  role
}) => (
  <ProfileLink
    userId={userId}
    name={name}
    avatarSrc={avatarSrc}
    showAvatar={showAvatar}
    className={className}
    showBadge={showBadge}
    role={role}
  />
);

export default ProfileAccessLayer;
