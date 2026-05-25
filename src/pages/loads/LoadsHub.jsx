import React, { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SegmentTabs from '../../components/ui/SegmentTabs.jsx';
import ManageLoads from './ManageLoads.jsx';
import CapacityMarketplace from '../../components/carrier/CapacityMarketplace.jsx';
import MySpaceListings from '../../components/carrier/MySpaceListings.jsx';
import AvailableLoads from './AvailableLoads.jsx';
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
  const defaultTab = isShipper ? 'posted' : 'freight';
  const tab = params.get('tab') || defaultTab;

  const tabs = useMemo(() => {
    if (isShipper) {
      return [
        { id: 'posted', label: t('loadsHub.myPosted') },
        { id: 'market', label: t('loadsHub.capacityMarket') }
      ];
    }
    return [];
  }, [isShipper, t]);

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

  if (isCarrier) {
    return (
      <div className="container py-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h5 className="mb-1">{t('loadsHub.carrierPageTitle')}</h5>
            <p className="text-muted small mb-0">{t('loadsHub.carrierOpsSubtitle')}</p>
          </div>
          <Link to="/carrier/space/post">
            <Button variant="outline-primary" className="btn-sm rounded-lg">
              + {t('loadsHub.listCapacity')}
            </Button>
          </Link>
        </div>

        <section className="mb-4">
          <h6 className="mb-2">{t('loadsHub.freightBoard')}</h6>
          <AvailableLoads embedded />
        </section>

        <section className="pt-3 border-top tp-border-theme">
          <h6 className="mb-2">{t('loadsHub.myCapacity')}</h6>
          <MySpaceListings />
        </section>
      </div>
    );
  }

  const setTab = (id) => {
    setParams({ tab: id }, { replace: true });
  };

  return (
    <div className="container py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h5 className="mb-1">{t('loadsHub.title')}</h5>
          <p className="text-muted small mb-0">{t('loadsHub.subtitle')}</p>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <SegmentTabs tabs={tabs} active={tab} onChange={setTab} />
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
      {tab === 'market' ? <CapacityMarketplace /> : null}
    </div>
  );
};

export default LoadsHub;
