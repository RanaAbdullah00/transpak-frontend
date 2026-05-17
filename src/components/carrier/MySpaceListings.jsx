import React, { useCallback, useEffect, useState } from 'react';
import Card from '../ui/Card.jsx';
import { SkeletonCard } from '../ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import CarrierSpaceCard from './CarrierSpaceCard.jsx';
import SpaceRequestsPanel from './SpaceRequestsPanel.jsx';
import { formatUserError } from '../../utils/userErrors.js';

const MySpaceListings = () => {
  const { t } = useLanguage();
  const { request, loading } = useApi();
  const [listings, setListings] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/carrier-space/mine' });
      setListings(Array.isArray(data) ? data : []);
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('loadsHub.loadSpaceFailed') }));
      setListings([]);
    }
  }, [request, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const closeListing = async (id) => {
    try {
      await request({ method: 'PATCH', url: `/carrier-space/${id}`, data: { status: 'closed' } });
      notifySuccess(t('loadsHub.spaceClosed'));
      refresh();
    } catch (err) {
      notifyError(formatUserError(err, t));
    }
  };

  if (loading && listings.length === 0) return <SkeletonCard rows={4} />;

  if (listings.length === 0) {
    return (
      <>
        <SpaceRequestsPanel />
        <Card className="p-4 text-center text-muted small">{t('loadsHub.noMySpace')}</Card>
      </>
    );
  }

  return (
    <>
      <SpaceRequestsPanel />
      <div className="row g-3">
      {listings.map((row) => (
        <div key={row.id} className="col-md-6 col-lg-4">
          <CarrierSpaceCard listing={row} mine onClose={() => closeListing(row.id)} />
        </div>
      ))}
      </div>
    </>
  );
};

export default MySpaceListings;
