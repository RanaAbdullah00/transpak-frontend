import React from 'react';
import VehicleCard from './VehicleCard.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const FleetList = ({ trucks = [] }) => {
  const { t } = useLanguage();
  if (!trucks.length) {
    return <p className="text-center text-muted small mt-3 mb-0">{t('pages.fleet.noVehicles')}</p>;
  }

  return (
    <div className="mt-2 row g-3">
      {trucks.map((truck) => (
        <div key={truck.id} className="col-12 col-md-6 col-xl-4">
          <VehicleCard truck={truck} />
        </div>
      ))}
    </div>
  );
};

export default FleetList;
