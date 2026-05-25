import React, { useMemo } from 'react';
import SafeImage from './SafeImage.jsx';

function initialsFrom(name, email) {
  const base = String(name || email || '?').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase() || '?';
}

/**
 * Profile avatar with initials fallback when URL missing or broken.
 */
const SafeAvatar = ({
  src,
  name,
  email,
  imgClassName = 'tp-img-cover',
  fallbackClassName = 'w-100 h-100 d-flex align-items-center justify-content-center tp-profile-avatar-fallback small fw-semibold'
}) => {
  const initials = useMemo(() => initialsFrom(name, email), [name, email]);
  const fallback = <div className={fallbackClassName}>{initials}</div>;

  return <SafeImage src={src} alt="" className={imgClassName} fallback={fallback} />;
};

export default SafeAvatar;
