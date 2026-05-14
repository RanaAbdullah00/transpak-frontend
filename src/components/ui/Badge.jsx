import React from 'react';

// Status badge with semantic variants.
const Badge = ({ children, variant = 'secondary', className = '' }) => (
  <span className={`badge rounded-pill bg-${variant} ${className}`}>{children}</span>
);

export default Badge;

