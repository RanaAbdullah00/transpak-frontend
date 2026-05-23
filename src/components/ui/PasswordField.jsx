import React, { useState } from 'react';
import { FaEye, FaEyeSlash, FaLock } from 'react-icons/fa';

/**
 * Password input with green visibility toggle (auth forms).
 */
const PasswordField = ({
  name,
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = '',
  required = false,
  autoComplete,
  invalid = false,
  isUrdu = false,
  showLockIcon = true
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`input-group input-group-sm ${className}`.trim()}>
      {showLockIcon && (
        <span className="input-group-text tp-input-group-addon">
          <FaLock className="tp-input-icon" />
        </span>
      )}
      <input
        type={visible ? 'text' : 'password'}
        name={name}
        className={`form-control rounded-3 ${invalid ? 'is-invalid' : ''} ${isUrdu ? 'text-end' : ''} ${inputClassName}`.trim()}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="input-group-text tp-password-toggle rounded-3"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <FaEyeSlash className="tp-password-toggle__icon" /> : <FaEye className="tp-password-toggle__icon" />}
      </button>
    </div>
  );
};

export default PasswordField;
