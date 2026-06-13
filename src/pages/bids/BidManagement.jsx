import React, { useState, useEffect, useCallback, useMemo } from 'react';
import BidList from '../../components/loadboard/BidList.jsx';
import BidTimeline from '../../components/bids/BidTimeline.jsx';
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
import { triggerAcceptActivationSync } from '../../utils/contractActivation.js';
import {
  commitOptimisticBidAccept,
  commitOptimisticBidReject,
  commitOptimisticBidSuggest
} from '../../utils/contractActivationLayer.js';

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
      const res = await request({ method: 'PUT', url: `/bids/${bid.id}/accept` });
      const loadCode = res?.loadCode || bid.loadCode || null;
      const payload = { ...res, loadCode };
      commitOptimisticBidAccept(bid.id, payload, {
        loadCode,
        carrierId: bid.carrierId,
        origin: bid.origin || bid.loadOrigin || null,
        destination: bid.destination || bid.loadDestination || null,
        userId: user?.id,
        role: user?.activeRole
      });
      await triggerAcceptActivationSync(payload, {
        userId: user?.id,
        role: user?.activeRole
      });
      notifySuccess(t('flowSession.bidFlowStarted'));
      void fetchBidsData();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.bids.acceptFailed') }));
    }
  };

  const handleSuggest = async (bid, amount) => {
    try {
      commitOptimisticBidSuggest(bid.id, amount, {
        suggestedBy: 'shipper',
        loadCode: bid.loadCode
      });
      await request({ method: 'PUT', url: `/bids/${bid.id}/suggest`, data: { amount } });
      notifySuccess(t('pages.bids.suggestSent', { amount: Number(amount).toLocaleString() }));
      void fetchBidsData();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.bids.suggestFailed') }));
    }
  };

  const handleReject = async (bid) => {
    try {
      commitOptimisticBidReject(bid.id, { loadCode: bid.loadCode });
      await request({ method: 'PUT', url: `/bids/${bid.id}/reject` });
      notifySuccess(t('pages.bids.bidRejected'));
      void fetchBidsData();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.bids.rejectFailed') }));
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
              distanceKm: normalized?.distanceKm ?? normalized?.distance ?? null,
              load: normalized
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

  const bidsByLoad = useMemo(() => {
    const map = new Map();
    for (const bid of bidsWithDistance) {
      const key = bid.loadId ? String(bid.loadId) : 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(bid);
    }
    return [...map.entries()];
  }, [bidsWithDistance]);

  useEffect(() => {
    const reconcile = () => {
      void fetchBidsData();
    };
    const onBidsRefresh = () => reconcile();
    const onLegacyRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (!scope || scope === 'all') return;
      if (scope === 'bids') reconcile();
    };
    window.addEventListener('tp:bids-refresh', onBidsRefresh);
    window.addEventListener('tp:bid-updated', onBidsRefresh);
    window.addEventListener('tp:contract-activated', onBidsRefresh);
    window.addEventListener('tp:realtime-refresh', onLegacyRefresh);
    return () => {
      window.removeEventListener('tp:bids-refresh', onBidsRefresh);
      window.removeEventListener('tp:bid-updated', onBidsRefresh);
      window.removeEventListener('tp:contract-activated', onBidsRefresh);
      window.removeEventListener('tp:realtime-refresh', onLegacyRefresh);
    };
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
        bidsByLoad.map(([loadId, groupBids]) => {
          const loadStub =
            loadMetaByLoad[loadId]?.load ||
            (groupBids[0]
              ? {
                  id: loadId,
                  status: groupBids.some((b) => String(b.status).toLowerCase() === 'accepted')
                    ? 'booked'
                    : 'open',
                  createdAt: groupBids[0]?.createdAt
                }
              : null);
          return (
            <div key={loadId} className="mb-4">
              {loadStub ? <BidTimeline load={loadStub} bids={groupBids} className="mb-3 p-3 rounded border bg-light-subtle" /> : null}
              <BidList
                bids={groupBids}
                mode="shipper"
                onAccept={handleAccept}
                onReject={handleReject}
                onSuggest={handleSuggest}
                actionsDisabled={!profileComplete}
              />
            </div>
          );
        })
      )}
    </div>
  );
};

export default BidManagement;

