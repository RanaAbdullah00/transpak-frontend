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
  const [params, setParams] = useSearchParams();
  const activeRole = user?.activeRole ?? user?.roles?.[0];
  const isShipper = activeRole === 'shipper';
  const isCarrier = activeRole === 'carrier';

  const defaultTab = isCarrier ? 'freight' : 'posted';
  const tab = params.get('tab') || defaultTab;

  const tabs = useMemo(() => {
    if (isShipper) {
      return [
        { id: 'posted', label: t('loadsHub.myPosted') },
        { id: 'market', label: t('loadsHub.capacityMarket') }
      ];
    }
    if (isCarrier) {
      return [
        { id: 'space', label: t('loadsHub.myCapacity') },
        { id: 'freight', label: t('loadsHub.freightBoard') }
      ];
    }
    return [];
  }, [isShipper, isCarrier, t]);

  useEffect(() => {
    document.body.classList.remove('tp-role-shipper', 'tp-role-carrier');
    if (isShipper) document.body.classList.add('tp-role-shipper');
    if (isCarrier) document.body.classList.add('tp-role-carrier');
    return () => {
      document.body.classList.remove('tp-role-shipper', 'tp-role-carrier');
    };
  }, [isShipper, isCarrier]);

  const setTab = (id) => {
    setParams({ tab: id }, { replace: true });
  };

  if (!isShipper && !isCarrier) {
    return <div className="container py-3 text-muted">{t('loadsHub.roleRequired')}</div>;
  }

  return (
    <div className="container py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h5 className="mb-1">{t('loadsHub.title')}</h5>
          <p className="text-muted small mb-0">{t('loadsHub.subtitle')}</p>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <SegmentTabs tabs={tabs} active={tab} onChange={setTab} />
          {isShipper && tab === 'posted' ? (
            <Link to="/loads/post">
              <Button variant="primary" className="btn-sm rounded-lg">
                + {t('pages.loads.postLoadCta')}
              </Button>
            </Link>
          ) : null}
          {isCarrier && tab === 'space' ? (
            <Link to="/carrier/space/post">
              <Button variant="primary" className="btn-sm rounded-lg">
                + {t('loadsHub.listCapacity')}
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {isShipper && tab === 'posted' ? <ManageLoads embedded /> : null}
      {isShipper && tab === 'market' ? <CapacityMarketplace /> : null}
      {isCarrier && tab === 'space' ? <MySpaceListings /> : null}
      {isCarrier && tab === 'freight' ? <AvailableLoads embedded /> : null}
    </div>
  );
};

export default LoadsHub;
