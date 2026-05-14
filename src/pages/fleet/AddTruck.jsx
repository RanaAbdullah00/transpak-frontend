import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

/** Legacy path: registration happens on Truck details (documents required). */
const AddTruck = () => {
  const { t, isUrdu } = useLanguage();
  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3">{t('pages.fleet.addTruckTitle')}</h5>
      <Card className="p-3 p-md-4">
        <p className="text-muted small mb-4">{t('pages.fleet.addTruckRedirectBody')}</p>
        <Link to="/carrier/truck-details" className="btn btn-primary rounded-pill fw-semibold">
          {t('pages.fleet.goToTruckDetails')}
        </Link>
      </Card>
    </div>
  );
};

export default AddTruck;
