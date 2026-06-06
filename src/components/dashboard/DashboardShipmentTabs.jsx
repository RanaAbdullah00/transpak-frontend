import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SegmentTabs from '../ui/SegmentTabs.jsx';
import ActiveShipmentsList from './ActiveShipmentsList.jsx';
import ShipmentHistoryPanel from './ShipmentHistoryPanel.jsx';
import ErrorBoundary from '../ui/ErrorBoundary.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const TAB_ACTIVE = 'active';
const TAB_HISTORY = 'history';

/**
 * Active + History tabs for shipper/carrier dashboards (read-only history split).
 */
const DashboardShipmentTabs = ({ carrierMode = false, activeEmptyState = null, historyLimit = 5 }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState(TAB_ACTIVE);

  const tabs = [
    { id: TAB_ACTIVE, label: t('pages.dashboard.tabActiveShipments') },
    { id: TAB_HISTORY, label: t('pages.dashboard.tabHistory') }
  ];

  return (
    <div className="tp-dashboard-shipment-tabs">
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <SegmentTabs tabs={tabs} active={tab} onChange={setTab} />
        {tab === TAB_HISTORY ? (
          <Link to="/shipments/history" className="small text-decoration-none">
            {t('common.viewAll')}
          </Link>
        ) : null}
      </div>
      {tab === TAB_ACTIVE ? (
        <ErrorBoundary compact>
          <ActiveShipmentsList carrierMode={carrierMode} emptyState={activeEmptyState} />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary compact>
          <ShipmentHistoryPanel carrierMode={carrierMode} limit={historyLimit} />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default DashboardShipmentTabs;
