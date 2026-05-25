import React from 'react';

/** Primary button — `type` defaults to button; pass type="submit" inside forms. */
const Button = ({ children, className = '', variant = 'primary', type = 'button', ...rest }) => (
  <button type={type} className={`btn btn-${variant} rounded-pill fw-semibold ${className}`} {...rest}>
    {children}
  </button>
);

export default Button;
