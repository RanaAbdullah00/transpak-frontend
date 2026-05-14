import React from 'react';
import { FaTruck, FaShip, FaPlane } from 'react-icons/fa';

/**
 * TransPak wordmark: TRANS (italic, theme-contrast) + PAK (green).
 * Subtle truck / ship / plane for logistics identity.
 */
const BrandLogo = ({ className = '', onClick, title = 'TransPak', variant = 'full' }) => {
  const isMark = variant === 'mark';
  const isAuth = variant === 'auth';

  const icons = (
    <span className="tp-brand-logo__modes" aria-hidden="true">
      <FaTruck className="tp-brand-logo__mode-icon" />
      <FaShip className="tp-brand-logo__mode-icon" />
      <FaPlane className="tp-brand-logo__mode-icon" />
    </span>
  );

  const wordmark = (
    <span className={`tp-brand-logo__wordmark ${isAuth ? 'tp-brand-logo__wordmark--auth' : ''}`}>
      <span className="tp-brand-logo__trans">TRANS</span>
      <span className="tp-brand-logo__pak">PAK</span>
    </span>
  );

  return (
    <div
      dir="ltr"
      className={`tp-brand-logo tp-brand-logo--ltr d-flex ${
        isMark
          ? 'flex-row align-items-center tp-brand-logo--mark'
          : isAuth
          ? 'flex-row align-items-center justify-content-start flex-wrap gap-2 tp-brand-logo--auth tp-brand-logo--auth-inline'
          : 'flex-column align-items-center justify-content-center'
      } ${className}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e);
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={title}
    >
      {isMark ? (
        <span className="tp-brand-logo__wordmark tp-brand-logo__wordmark--compact">
          <span className="tp-brand-logo__trans">TRANS</span>
          <span className="tp-brand-logo__pak">PAK</span>
        </span>
      ) : (
        wordmark
      )}
      {!isMark && !isAuth ? <span className="tp-brand-logo__rule" aria-hidden="true" /> : null}
      {isAuth ? <span className="tp-brand-logo__rule tp-brand-logo__rule--vertical d-none d-sm-inline" aria-hidden="true" /> : null}
      <div
        className={`tp-brand-logo__icons ${isMark ? 'tp-brand-logo__icons--mark' : ''} ${isAuth ? 'tp-brand-logo__icons--auth' : ''}`}
        aria-hidden="true"
      >
        {icons}
      </div>
    </div>
  );
};

export default BrandLogo;
