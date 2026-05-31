import React, { useState, useEffect, useCallback } from 'react';
import BidList from '../../components/loadboard/BidList.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { ensureArray } from '../../utils/unwrapApi.js';
import { normalizeBids, normalizeLoads } from '../../adapters/normalize.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { formatUserError } from '../../utils/userErrors.js';
import { mergeWorkspaceParams } from '../../utils/workspaceApi.js';
import { usePollingAllowed } from '../../hooks/useSocketPolling.js';
import { emitRealtimeRefresh } from '../../utils/realtimeRefresh.js';

// Screen summarising bids across loads.
const BidManagement = () => {
  const { t, isUrdu } = useLanguage();
  const [bids, setBids] = useState([]);
  const [loadMetaByLoad, setLoadMetaByLoad] = useState({});
  const { user } = useAuth();
  const profileComplete = user?.profileComplete === true;
  const { request, loading } = useApi();
  const pollingAllowed = usePollingAllowed();

  const fetchBidsData = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/bids', params: mergeWorkspaceParams(user) });
      setBids(normalizeBids(ensureArray(data)));
    } catch (err) {
      notifyError(t('pages.bids.loadBidsFailed'));
      setBids([]);
    }
  }, [request, t, user]);

  const handleAccept = async (bid) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/accept` });
      notifySuccess(t('pages.bids.bidAccepted'));
      emitRealtimeRefresh('bids');
      fetchBidsData();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.bids.acceptFailed') }));
    }
  };

  const handleReject = async (bid) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/reject` });
      notifySuccess(t('pages.bids.bidRejected'));
      emitRealtimeRefresh('bids');
      fetchBidsData();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.bids.rejectFailed') }));
    }
  };

  const handleSuggest = async (bid, amount) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/suggest`, data: { amount } });
      notifySuccess(t('pages.bids.suggestSent', { amount: Number(amount).toLocaleString() }));
      emitRealtimeRefresh('bids');
      fetchBidsData();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.bids.suggestFailed') }));
    }
  };

  useEffect(() => {
    fetchBidsData();
  }, [fetchBidsData]);

  useEffect(() => {
    const ids = [...new Set(bids.map((b) => b.loadId).filter(Boolean))];
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
            const normalized = normalizeLoads([load])[0];
            next[lid] = {
              distanceKm: normalized?.distanceKm ?? normalized?.distance ?? null
            };
          } catch {
            /* load may be restricted */
          }
        })
      );
      if (!cancelled) setLoadMetaByLoad(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [bids, request]);

  const bidsWithDistance = bids.map((b) => {
    const lid = b.loadId ? String(b.loadId) : null;
    const distanceKm = lid ? loadMetaByLoad[lid]?.distanceKm : null;
    return distanceKm != null && distanceKm > 0 ? { ...b, distanceKm } : b;
  });

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

  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3">{t('pages.bids.bidManagementTitle')}</h5>
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : (
        <BidList bids={bidsWithDistance} mode="shipper" onAccept={handleAccept} onReject={handleReject} onSuggest={handleSuggest} actionsDisabled={!profileComplete} />
      )}
    </div>
  );
};

export default BidManagement;

