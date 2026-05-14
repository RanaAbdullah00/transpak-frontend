import React from 'react';

// Primary button abstraction to keep a consistent style.
const Button = ({ children, className = '', variant = 'primary', ...rest }) => (
  <button
    type="button"
    className={`btn btn-${variant} rounded-pill fw-semibold ${className}`}
    {...rest}
  >
    {children}
  </button>
);

export default Button;

