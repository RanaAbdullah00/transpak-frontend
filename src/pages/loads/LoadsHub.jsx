/**
 * Phase 2 — LoadsHub carrier capacity browse removed; carriers see freight loads only.
 */
import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SegmentTabs from '../../components/ui/SegmentTabs.jsx';
import AvailableLoads from './AvailableLoads.jsx';
import ManageLoads from './ManageLoads.jsx';
import CapacityMarketplace from '../../components/carrier/CapacityMarketplace.jsx';
import MySpaceListings from '../../components/carrier/MySpaceListings.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';

const LoadsHub = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const activeRole = user?.activeRole ?? user?.roles?.[0];
  const isShipper = activeRole === 'shipper';
  const isCarrier = activeRole === 'carrier';

  const [params, setParams] = useSearchParams();
  const defaultTab = isShipper ? 'posted' : 'marketplace';
  const tab = params.get('tab') || defaultTab;

  const shipperTabs = React.useMemo(
    () => [
      { id: 'posted', label: t('loadsHub.myPosted') },
      { id: 'market', label: t('loadsHub.capacityMarket') }
    ],
    [t]
  );

  useEffect(() => {
    if (isCarrier) {
      if (tab === 'freight' || tab === 'capacity') {
        setParams({ tab: 'marketplace' }, { replace: true });
        return;
      }
      if (tab !== 'marketplace' && tab !== 'my-listings') {
        setParams({ tab: 'marketplace' }, { replace: true });
      }
    }
    if (isShipper && tab !== 'posted' && tab !== 'market') {
      setParams({ tab: 'posted' }, { replace: true });
    }
  }, [isCarrier, isShipper, tab, setParams]);

  useEffect(() => {
    document.body.classList.remove('tp-role-shipper', 'tp-role-carrier');
    if (isShipper) document.body.classList.add('tp-role-shipper');
    if (isCarrier) document.body.classList.add('tp-role-carrier');
    return () => {
      document.body.classList.remove('tp-role-shipper', 'tp-role-carrier');
    };
  }, [isShipper, isCarrier]);

  if (!isShipper && !isCarrier) {
    return <div className="container py-3 text-muted">{t('loadsHub.roleRequired')}</div>;
  }

  const setTab = (id) => {
    setParams({ tab: id }, { replace: true });
  };

  if (isCarrier) {
    return (
      <div className="container py-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h5 className="mb-1">
              {tab === 'my-listings' ? t('loadsHub.myCapacity') : t('loadsHub.marketplaceTitle')}
            </h5>
            <p className="text-muted small mb-0">
              {tab === 'my-listings'
                ? t('loadsHub.capacityHubSubtitle')
                : t('loadsHub.carrierFreightSubtitle')}
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <SegmentTabs
              tabs={[
                { id: 'marketplace', label: t('loadsHub.marketplaceTitle') },
                { id: 'my-listings', label: t('loadsHub.myCapacity') }
              ]}
              active={tab}
              onChange={setTab}
            />
            {tab === 'my-listings' ? (
              <Link to="/carrier/space/post">
                <Button variant="primary" className="btn-sm rounded-lg">
                  + {t('loadsHub.listCapacity')}
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
        {tab === 'marketplace' ? <AvailableLoads embedded /> : <MySpaceListings hideIncomingRequests />}
      </div>
    );
  }

  return (
    <div className="container py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h5 className="mb-1">{t('loadsHub.title')}</h5>
          <p className="text-muted small mb-0">{t('loadsHub.subtitle')}</p>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <SegmentTabs tabs={shipperTabs} active={tab} onChange={setTab} />
          {tab === 'posted' ? (
            <Link to="/loads/post">
              <Button variant="primary" className="btn-sm rounded-lg">
                + {t('pages.loads.postLoadCta')}
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {tab === 'posted' ? <ManageLoads embedded /> : null}
      {tab === 'market' ? <CapacityMarketplace hubLayout /> : null}
    </div>
  );
};

export default LoadsHub;
