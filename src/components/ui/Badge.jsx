import React from 'react';
import { sanitizeBadgeVariant } from '../../utils/badgeVariants.js';

// Status badge with semantic variants.
const Badge = ({ children, variant = 'secondary', className = '' }) => {
  const safe = sanitizeBadgeVariant(variant);
  return (
    <span className={`badge rounded-pill bg-${safe} ${className}`}>{children}</span>
  );
};

export default Badge;

