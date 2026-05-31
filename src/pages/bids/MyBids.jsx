import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../../components/ui/Loader.jsx';
import BidList from '../../components/loadboard/BidList.jsx';
import { useApi } from '../../hooks/useApi.js';
import { normalizeTrucksResponse } from '../../utils/fleetApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { normalizeBids, normalizeLoads } from '../../adapters/normalize.js';
import { ensureArray } from '../../utils/unwrapApi.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { formatUserError } from '../../utils/userErrors.js';
import { usePollingAllowed } from '../../hooks/useSocketPolling.js';
import { emitRealtimeRefresh } from '../../utils/realtimeRefresh.js';

import { isTruckMatchingEligible } from '../../utils/fleetApi.js';
import { isActiveBidStatus } from '../../utils/bidStatus.js';

const isTruckComplete = (t) =>
  isTruckMatchingEligible(t) &&
  (t.engineNumber || t.truckNumber) &&
  (t.truckCardFrontImage || t.truckFrontImage) &&
  (t.truckCardBackImage || t.truckBackImage);

const MyBids = () => {
  const { t, isUrdu } = useLanguage();
  const { user } = useAuth();
  const profileComplete = user?.profileComplete === true;
  const { request, loading } = useApi();
  const pollingAllowed = usePollingAllowed();
  const [bids, setBids] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loadMetaByLoad, setLoadMetaByLoad] = useState({});

  const fetchTrucks = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/trucks/mine' });
      setTrucks(normalizeTrucksResponse(data));
    } catch {
      setTrucks([]);
    }
  }, [request]);

  const trucksComplete = trucks.length > 0 && trucks.some(isTruckComplete);

  const fetchBidsData = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/bids/mine' });
      setBids(normalizeBids(ensureArray(data)));
    } catch (err) {
      notifyError(t('pages.bids.loadBidsFailed'));
      setBids([]);
    }
  }, [request, t]);

  useEffect(() => {
    fetchBidsData();
  }, [fetchBidsData]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'bids') return;
      fetchBidsData();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [fetchBidsData]);

  useEffect(() => {
    if (!pollingAllowed) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') fetchBidsData();
    };
    const interval = setInterval(tick, 25000);
    return () => clearInterval(interval);
  }, [fetchBidsData, pollingAllowed]);

  useEffect(() => {
    fetchTrucks();
  }, [fetchTrucks]);

  useEffect(() => {
    const ids = [...new Set(bids.map((b) => (b.loadId ? String(b.loadId) : null)).filter(Boolean))];
    if (!ids.length) {
      setLoadMetaByLoad({});
      return;
    }
    let cancelled = false;
    (async () => {
      const next = {};
      await Promise.all(
        ids.map(async (lid) => {
          try {
            const load = await request({ url: `/loads/${lid}` });
            if (load?.shipperId) {
              const normalized = normalizeLoads([load])[0];
              next[lid] = {
                shipperId: String(load.shipperId),
                code: load.code || '',
                distanceKm: normalized?.distanceKm ?? normalized?.distance ?? null
              };
            }
          } catch {
            /* e.g. not yet assigned — hide badge until load is visible */
          }
        })
      );
      if (!cancelled) setLoadMetaByLoad(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [bids, request]);

  const shipperIdByLoadId = Object.fromEntries(
    Object.entries(loadMetaByLoad).map(([k, v]) => [k, v.shipperId])
  );
  const counterpartyLabelByLoadId = Object.fromEntries(
    Object.entries(loadMetaByLoad).map(([k, v]) => [k, `${t('auth.shipper')} · ${v.code || k.slice(0, 8)}`])
  );
  const distanceByLoadId = Object.fromEntries(
    Object.entries(loadMetaByLoad).map(([k, v]) => [k, v.distanceKm ?? null])
  );
  const bidsWithDistance = bids.map((b) => {
    const lid = b.loadId ? String(b.loadId) : null;
    const distanceKm = lid ? distanceByLoadId[lid] : null;
    return distanceKm != null && distanceKm > 0 ? { ...b, distanceKm } : b;
  });

  const actionsDisabled = !profileComplete || !trucksComplete;

  const handleAcceptSuggestion = async (bid) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/accept-suggestion` });
      notifySuccess(t('pages.bids.suggestionAccepted'));
      emitRealtimeRefresh('bids');
      fetchBidsData();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.bids.acceptSuggestionFailed') }));
    }
  };

  const handleRejectSuggestion = async (bid) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/reject-suggestion` });
      notifySuccess(t('pages.bids.suggestionRejected'));
      emitRealtimeRefresh('bids');
      fetchBidsData();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.bids.rejectSuggestionFailed') }));
    }
  };

  const handleSuggest = async (bid, amount) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/suggest-carrier`, data: { amount } });
      notifySuccess(t('pages.bids.suggestSent', { amount: Number(amount).toLocaleString() }));
      emitRealtimeRefresh('bids');
      fetchBidsData();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.bids.suggestFailed') }));
    }
  };

  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3">{t('pages.bids.myBidsTitle')}</h5>
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : (
        <>
          {actionsDisabled && bids.some((b) => isActiveBidStatus(b.status)) && (
            <div className="alert alert-warning mb-3">
              {t('pages.bids.completeProfilePrefix')}{' '}
              <Link to="/profile" className="alert-link">
                {t('common.profile')}
              </Link>{' '}
              {t('pages.bids.completeProfileAnd')}{' '}
              <Link to="/carrier/truck-details" className="alert-link">
                {t('nav.truckDetails')}
              </Link>{' '}
              {t('pages.bids.completeProfileSuffix')}
            </div>
          )}
          <BidList
            bids={bidsWithDistance}
            mode="carrier"
            onAcceptSuggestion={handleAcceptSuggestion}
            onRejectSuggestion={handleRejectSuggestion}
            onSuggest={handleSuggest}
            actionsDisabled={actionsDisabled}
            shipperIdByLoadId={shipperIdByLoadId}
            counterpartyLabelByLoadId={counterpartyLabelByLoadId}
          />
        </>
      )}
    </div>
  );
};

export default MyBids;

