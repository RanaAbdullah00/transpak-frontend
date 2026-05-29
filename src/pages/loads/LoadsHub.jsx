import React, { useEffect, useMemo } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import SegmentTabs from '../../components/ui/SegmentTabs.jsx';
import ManageLoads from './ManageLoads.jsx';
import CapacityMarketplace from '../../components/carrier/CapacityMarketplace.jsx';
import Button from '../../components/ui/Button.jsx';
import PostCarrierSpace from '../carrier/PostCarrierSpace.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';

const LoadsHub = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const activeRole = user?.activeRole ?? user?.roles?.[0];
  const isShipper = activeRole === 'shipper';
  const isCarrier = activeRole === 'carrier';

  const [params, setParams] = useSearchParams();
  const defaultTab = isShipper ? 'posted' : 'capacity';
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
        <div className="mb-3">
          <h5 className="mb-1">{t('loadsHub.capacityHubTitle')}</h5>
          <p className="text-muted small mb-0">{t('loadsHub.capacityHubSubtitle')}</p>
        </div>
        <PostCarrierSpace embedded />
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
