import React from 'react';
import { VEHICLE_TYPES } from '../../data/vehicleTypes.js';
import { useLanguage } from '../../hooks/useLanguage.js';

/**
 * Compact localized vehicle select for filters and forms.
 */
const VehicleTypeDropdown = ({
  value,
  onChange,
  name = 'vehicleType',
  id,
  className = 'form-select form-select-sm rounded-3',
  disabled = false,
  includeAllOption = false,
  allOptionLabel,
  'aria-label': ariaLabel
}) => {
  const { lang, t } = useLanguage();
  const locale = lang === 'ur' ? 'ur' : 'en';
  const emptyLabel = allOptionLabel ?? t('pages.loads.vehicleType');

  return (
    <select
      name={name}
      id={id}
      className={className}
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel || t('pages.postLoadForm.vehicleType')}
    >
      {includeAllOption ? <option value="">{emptyLabel}</option> : null}
      {VEHICLE_TYPES.map((item) => {
        const meta = item[locale] || item.en;
        return (
          <option key={item.value} value={item.value}>
            {meta?.label || item.value}
          </option>
        );
      })}
    </select>
  );
};

export default VehicleTypeDropdown;
