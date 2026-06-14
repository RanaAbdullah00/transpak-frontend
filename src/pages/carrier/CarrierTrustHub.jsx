import React, { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SegmentTabs from '../../components/ui/SegmentTabs.jsx';
import Card from '../../components/ui/Card.jsx';
import CarrierVerification from '../auth/CarrierVerification.jsx';
import ProfileRolePanel from '../../components/profile/ProfileRolePanel.jsx';
import ActiveShipmentsList from '../../components/dashboard/ActiveShipmentsList.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const TAB_TRACKING = 'tracking';
const TAB_VERIFICATION = 'verification';
const TAB_SCORE = 'score';
const VALID_TABS = new Set([TAB_TRACKING, TAB_VERIFICATION, TAB_SCORE]);

const CarrierTrustHub = () => {
  const { t, isUrdu } = useLanguage();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab') || TAB_TRACKING;
  const tab = VALID_TABS.has(rawTab) ? rawTab : TAB_TRACKING;

  useEffect(() => {
    if (rawTab && !VALID_TABS.has(rawTab)) {
      setParams({ tab: TAB_TRACKING }, { replace: true });
    }
  }, [rawTab, setParams]);

  const setTab = (id) => setParams({ tab: id }, { replace: true });

  const tabs = useMemo(
    () => [
      { id: TAB_TRACKING, label: t('nav.shipmentsTracking') },
      { id: TAB_VERIFICATION, label: t('nav.carrierVerification') },
      { id: TAB_SCORE, label: t('nav.carrierScore') }
    ],
    [t]
  );

  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="mb-3">
        <h5 className="mb-1">{t('nav.carrierTrustHub')}</h5>
        <p className="small text-muted mb-0">{t('pages.carrierTrustHub.lead')}</p>
      </div>
      <SegmentTabs tabs={tabs} active={tab} onChange={setTab} className="mb-3" />
      {tab === TAB_TRACKING ? (
        <>
          <Card className="p-3 mb-3">
            <p className="small text-muted mb-2">{t('pages.carrierTrustHub.trackingLead')}</p>
            <Link to="/shipments/active" className="btn btn-sm btn-outline-primary me-2">
              {t('nav.shipmentsActive')}
            </Link>
          </Card>
          <ActiveShipmentsList carrierMode statusFilter="in_transit" />
        </>
      ) : null}
      {tab === TAB_VERIFICATION ? <CarrierVerification embedded /> : null}
      {tab === TAB_SCORE ? (
        <Card className="p-3">
          <ProfileRolePanel scoreOnly />
        </Card>
      ) : null}
    </div>
  );
};

export default CarrierTrustHub;
