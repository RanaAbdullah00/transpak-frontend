import React from 'react';
import { FaTruck, FaTruckLoading, FaSnowflake, FaGasPump, FaBox, FaDumpster } from 'react-icons/fa';
import { VEHICLE_TYPES } from '../../data/vehicleTypes.js';
import { useLanguage } from '../../hooks/useLanguage.js';

const ICONS = {
  flatbed: FaTruck,
  container: FaBox,
  reefer: FaSnowflake,
  tanker: FaGasPump,
  trailer: FaTruckLoading,
  dumper: FaDumpster,
  mazda: FaTruck,
  pickup: FaTruck,
  loader: FaTruckLoading,
  truck: FaTruck,
  wheeler10: FaTruckLoading,
  wheeler22: FaTruckLoading
};

const VehicleTypeSelect = ({ value, onChange, name = 'vehicleType' }) => {
  const { lang, t } = useLanguage();
  const locale = lang === 'ur' ? 'ur' : 'en';

  return (
    <div className="tp-vehicle-type-select">
      <label className="form-label small">{t('pages.postLoadForm.vehicleType')}</label>
      <div className="tp-vehicle-type-grid" role="listbox" aria-label={t('pages.postLoadForm.vehicleType')}>
        {VEHICLE_TYPES.map((item) => {
          const meta = item[locale] || item.en;
          const Icon = ICONS[item.icon] || FaTruck;
          const selected = value === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected={selected}
              className={`tp-vehicle-type-card ${selected ? 'is-selected' : ''}`}
              onClick={() => onChange?.({ target: { name, value: item.value } })}
            >
              <Icon className="tp-vehicle-type-card__icon" aria-hidden />
              <span className="tp-vehicle-type-card__title">{meta.label}</span>
              <span className="tp-vehicle-type-card__use">{meta.use}</span>
              <span className="tp-vehicle-type-card__cap">{meta.capacity}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VehicleTypeSelect;
