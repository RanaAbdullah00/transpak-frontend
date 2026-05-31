import React, { useCallback, useEffect, useState } from 'react';
import Card from '../ui/Card.jsx';
import { SkeletonCard } from '../ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import CarrierSpaceCard from './CarrierSpaceCard.jsx';
import EditCarrierSpaceModal from './EditCarrierSpaceModal.jsx';
import SpaceRequestsPanel from './SpaceRequestsPanel.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { emitRealtimeRefresh } from '../../utils/realtimeRefresh.js';

const MySpaceListings = () => {
  const { t } = useLanguage();
  const { request, loading } = useApi();
  const [listings, setListings] = useState([]);
  const [editListing, setEditListing] = useState(null);

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

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'loads' && scope !== 'space') return;
      refresh();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [refresh]);

  const closeListing = async (id) => {
    try {
      await request({ method: 'PATCH', url: `/carrier-space/${id}`, data: { status: 'closed' } });
      notifySuccess(t('loadsHub.spaceClosed'));
      emitRealtimeRefresh('loads');
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
          <CarrierSpaceCard
            listing={row}
            mine
            onClose={() => closeListing(row.id)}
            onEdit={setEditListing}
          />
        </div>
      ))}
      </div>
      <EditCarrierSpaceModal
        listing={editListing}
        open={Boolean(editListing)}
        onClose={() => setEditListing(null)}
        onSaved={refresh}
      />
    </>
  );
};

export default MySpaceListings;
