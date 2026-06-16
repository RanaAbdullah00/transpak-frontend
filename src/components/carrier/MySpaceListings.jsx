import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card.jsx';
import Modal from '../ui/Modal.jsx';
import { SkeletonCard } from '../ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useRatingSummaryBatch } from '../../hooks/useRatingSummaryBatch.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import CarrierSpaceCard from './CarrierSpaceCard.jsx';
import EditCarrierSpaceModal from './EditCarrierSpaceModal.jsx';
import SpaceRequestsPanel from './SpaceRequestsPanel.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { emitRealtimeRefresh } from '../../utils/realtimeRefresh.js';

const MySpaceListings = ({ hideIncomingRequests = false }) => {
  const { t } = useLanguage();
  const { request, loading } = useApi();
  const [listings, setListings] = useState([]);
  const [editListing, setEditListing] = useState(null);
  const [requestsListing, setRequestsListing] = useState(null);

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

  const ratingUserIds = useMemo(() => {
    const ids = new Set();
    for (const row of listings) {
      if (row?.carrierId) ids.add(String(row.carrierId));
    }
    return [...ids];
  }, [listings]);
  const { ratingMap, loading: ratingsLoading } = useRatingSummaryBatch(ratingUserIds);

  const closeListing = async (id) => {
    try {
      await request({ method: 'PATCH', url: `/carrier-space/${id}`, data: { status: 'closed' } });
      notifySuccess(t('loadsHub.spaceClosed'));
      emitRealtimeRefresh('loads');
      await refresh();
    } catch (err) {
      const code = err?.response?.data?.error?.code || err?.code;
      if (code === 'LISTING_ACTIVE') {
        notifyError(t('loadsHub.spaceCloseActive'));
      } else if (code === 'FORBIDDEN_OWNER' || code === 'FORBIDDEN_ROLE') {
        notifyError(t('loadsHub.spaceCloseForbidden'));
      } else {
        notifyError(formatUserError(err, t, { fallback: t('loadsHub.spaceCloseFailed') }));
      }
    }
  };

  if (loading && listings.length === 0) return <SkeletonCard rows={4} />;

  if (listings.length === 0) {
    return (
      <>
        {!hideIncomingRequests ? <SpaceRequestsPanel /> : null}
        <Card className="p-4 text-center text-muted small">{t('loadsHub.noMySpace')}</Card>
      </>
    );
  }

  return (
    <>
      {!hideIncomingRequests ? <SpaceRequestsPanel /> : null}
      <div className="row g-3">
        {listings.map((row) => (
          <div key={row.id} className="col-md-6 col-lg-4">
            <CarrierSpaceCard
              listing={row}
              mine
              ratingMap={ratingMap}
              ratingsLoading={ratingsLoading}
              onClose={() => closeListing(row.id)}
              onEdit={setEditListing}
              onViewRequests={setRequestsListing}
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
      <Modal
        open={Boolean(requestsListing)}
        title={
          requestsListing
            ? `${requestsListing.origin} → ${requestsListing.destination}`
            : t('loadsHub.incomingRequests')
        }
        onClose={() => setRequestsListing(null)}
        size="lg"
      >
        {requestsListing ? (
          <SpaceRequestsPanel listingIdFilter={requestsListing.id} embedded />
        ) : null}
      </Modal>
    </>
  );
};

export default MySpaceListings;
