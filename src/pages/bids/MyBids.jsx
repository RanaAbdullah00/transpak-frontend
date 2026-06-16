import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { triggerAcceptActivationSync } from '../../utils/contractActivation.js';
import {
  commitOptimisticBidAccept,
  commitOptimisticBidReject,
  commitOptimisticBidSuggest,
  emitScopedRefresh
} from '../../utils/contractActivationLayer.js';
import { createDebouncedRefresh } from '../../utils/refreshDebounce.js';

import { isTruckMatchingEligible } from '../../utils/fleetApi.js';
import {
  BID_STATUS,
  isActiveBidStatus,
  isBidExpired,
  isCounterOffered,
  isTerminalBidStatus,
  normalizeBidStatus
} from '../../utils/bidStatus.js';

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
  const [tab, setTab] = useState('active');

  const tabFilteredBids = useMemo(() => {
    return bids.filter((bid) => {
      const st = normalizeBidStatus(bid.status);
      if (tab === 'active') {
        return isActiveBidStatus(st) && !isBidExpired(bid);
      }
      if (tab === 'accepted') return st === BID_STATUS.ACCEPTED;
      if (tab === 'history') {
        return isTerminalBidStatus(st) || isBidExpired(bid);
      }
      return true;
    });
  }, [bids, tab]);

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
    const reconcile = createDebouncedRefresh(() => {
      void fetchBidsData();
    });
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
                origin: load.origin || normalized?.origin || null,
                destination: load.destination || normalized?.destination || null,
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
  const bidsWithDistance = tabFilteredBids.map((b) => {
    const lid = b.loadId ? String(b.loadId) : null;
    const meta = lid ? loadMetaByLoad[lid] : null;
    const distanceKm = lid ? distanceByLoadId[lid] : null;
    const enriched = {
      ...b,
      loadCode: b.loadCode || meta?.code || null
    };
    return distanceKm != null && distanceKm > 0 ? { ...enriched, distanceKm } : enriched;
  });

  const actionsDisabled = !profileComplete || !trucksComplete;

  const handleAcceptSuggestion = async (bid) => {
    try {
      const res = await request({ method: 'PUT', url: `/bids/${bid.id}/accept-suggestion` });
      const loadCode = res?.loadCode || bid.loadCode || loadMetaByLoad[String(bid.loadId)]?.code || null;
      const payload = { ...res, loadCode };
      commitOptimisticBidAccept(bid.id, payload, {
        loadCode,
        carrierId: user?.id,
        origin: loadMetaByLoad[String(bid.loadId)]?.origin || null,
        destination: loadMetaByLoad[String(bid.loadId)]?.destination || null,
        userId: user?.id,
        role: 'carrier'
      });
      await triggerAcceptActivationSync(payload, {
        userId: user?.id,
        role: 'carrier'
      });
      notifySuccess(t('pages.bids.suggestionAccepted'));
      void fetchBidsData();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.bids.acceptSuggestionFailed') }));
    }
  };

  const handleRejectSuggestion = async (bid) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/reject-suggestion` });
      notifySuccess(t('pages.bids.suggestionRejected'));
      emitScopedRefresh('bids');
      fetchBidsData();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.bids.rejectSuggestionFailed') }));
    }
  };

  const handleSuggest = async (bid, amount) => {
    try {
      commitOptimisticBidSuggest(bid.id, amount, {
        suggestedBy: 'carrier',
        loadCode: bid.loadCode
      });
      await request({ method: 'PUT', url: `/bids/${bid.id}/suggest-carrier`, data: { amount } });
      notifySuccess(t('pages.bids.suggestSent', { amount: Number(amount).toLocaleString() }));
      void fetchBidsData();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.bids.suggestFailed') }));
    }
  };

  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3">{t('pages.bids.myBidsTitle')}</h5>
      <ul className="nav nav-tabs mb-3 flex-nowrap overflow-auto">
        {[
          { id: 'active', label: t('pages.bids.tabOpen') },
          { id: 'accepted', label: t('pages.bids.tabActive') },
          { id: 'history', label: t('pages.bids.tabHistory') }
        ].map(({ id, label }) => (
          <li className="nav-item" key={id}>
            <button
              type="button"
              className={`nav-link ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
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

