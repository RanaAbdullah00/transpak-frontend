import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';

/**
 * Shipper / Carrier: two horizontal buttons (same container as form).
 * Active = primary; inactive = subtle outline (theme tokens).
 */
const RoleSelector = ({ value, onChange, onlyRole = null }) => {
  const { t, isUrdu } = useLanguage();

  const showShipper = !onlyRole || onlyRole === 'shipper';
  const showCarrier = !onlyRole || onlyRole === 'carrier';

  const btnClass = (role) => {
    const active = value === role;
    return [
      'btn',
      'flex-fill',
      'rounded-3',
      'tp-role-toggle__btn',
      'tp-role-toggle__btn--comfortable',
      active ? 'tp-role-toggle__btn--active' : 'tp-role-toggle__btn--inactive'
    ].join(' ');
  };

  return (
    <div
      className={`tp-role-toggle tp-role-toggle--glass d-flex flex-column flex-sm-row gap-2 gap-sm-3 mb-3 w-100 ${isUrdu ? 'tp-rtl' : ''}`}
      role="group"
      aria-label={t('auth.role')}
    >
      {showShipper && (
        <button type="button" className={btnClass('shipper')} onClick={() => onChange('shipper')}>
          {t('auth.shipper')}
        </button>
      )}
      {showCarrier && (
        <button type="button" className={btnClass('carrier')} onClick={() => onChange('carrier')}>
          {t('auth.carrier')}
        </button>
      )}
    </div>
  );
};

export default RoleSelector;
