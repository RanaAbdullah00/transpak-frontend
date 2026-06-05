import React from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import ActiveShipmentsList from '../../components/dashboard/ActiveShipmentsList.jsx';

const ShipmentsActive = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const activeRole = user?.activeRole ?? user?.roles?.[0];
  const carrierMode = activeRole === 'carrier';

  return (
    <div className="container py-3">
      <h5 className="mb-1">{t('pages.shipments.activeTitle')}</h5>
      <p className="small text-muted mb-3">{t('pages.shipments.activeLead')}</p>
      <ActiveShipmentsList carrierMode={carrierMode} />
    </div>
  );
};

export default ShipmentsActive;
