import React from 'react';

// Generic card container with soft shadow and hover effect.
const Card = ({ children, className = '', hover }) => (
  <div className={`card border-0 shadow-sm rounded-xl mb-3 card-modern ${hover ? 'card-hover' : ''} ${className}`}>
    <div className="card-body">{children}</div>
  </div>
);

export default Card;

