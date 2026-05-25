import React from 'react';
import { getVehicleTypeLabel } from '../../data/vehicleTypes.js';
import { useLanguage } from '../../hooks/useLanguage.js';

/** Inline localized vehicle type label (badges, cards). */
const VehicleTypeLabel = ({ value, className }) => {
  const { lang } = useLanguage();
  const label = getVehicleTypeLabel(value, lang === 'ur' ? 'ur' : 'en');
  return className ? <span className={className}>{label}</span> : label;
};

export default VehicleTypeLabel;
