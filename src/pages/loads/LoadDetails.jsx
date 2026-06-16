import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LoadCard from '../../components/loadboard/LoadCard.jsx';
import BidTimeline from '../../components/bids/BidTimeline.jsx';
import BidList from '../../components/loadboard/BidList.jsx';
import { SkeletonCard } from '../../components/ui/Skeleton.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import {
  notifyError,
  notifySuccess,
  notifyBidRejected,
  notifyCounterOffer
} from '../../components/ui/ToastProvider.jsx';
import { normalizeLoads, normalizeBids } from '../../adapters/normalize.js';
import { formatUserError } from '../../utils/userErrors.js';
import { mergeWorkspaceParams } from '../../utils/workspaceApi.js';
import { useRatingSummaryBatch } from '../../hooks/useRatingSummaryBatch.js';
import { triggerAcceptActivationSync } from '../../utils/contractActivation.js';
import {
  commitOptimisticBidAccept,
  commitOptimisticBidReject,
  commitOptimisticBidSuggest,
  emitScopedRefresh
} from '../../utils/contractActivationLayer.js';
import { ensureArray } from '../../utils/unwrapApi.js';

const LoadDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { request } = useApi();

  const [load, setLoad] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  const activeRole = user?.activeRole ?? user?.roles?.[0];
  const uid = user?.id || user?._id;
  const isOwner = useMemo(
    () => load && uid && String(load.shipperId) === String(uid),
    [load, uid]
  );
  const { ratingMap, loading: ratingsLoading } = useRatingSummaryBatch(
    load?.shipperId ? [load.shipperId] : []
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await request({ url: `/loads/${id}` });
      const normalizedLoads = normalizeLoads([raw]);
      const loadRow = normalizedLoads[0] || null;
      setLoad(loadRow);
      const ownsLoad = loadRow && uid && String(loadRow.shipperId) === String(uid);
      if (ownsLoad) {
        const bidRows = await request({ url: '/bids', params: { loadId: id, ...mergeWorkspaceParams(user) } });
        setBids(normalizeBids(ensureArray(bidRows)));
      } else {
        setBids([]);
      }
    } catch (error) {
      notifyError(formatUserError(error, t, { fallback: t('pages.loads.failedLoadDetail') }));
      setLoad(null);
      setBids([]);
    } finally {
      setLoading(false);
    }
  }, [id, request, uid, user, t]);

  useEffect(() => {
    if (!id || !user) return;
    fetchData();
  }, [id, user?.id, fetchData]);

  useEffect(() => {
    const reconcile = () => {
      void fetchData();
    };
    const onBidsRefresh = () => reconcile();
    const onLegacyRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (!scope || scope === 'all') return;
      if (scope === 'bids' || scope === 'loads' || scope === 'shipments' || scope === 'space') {
        reconcile();
      }
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
  }, [fetchData]);

  const handleAccept = async (bid) => {
    try {
      const res = await request({ method: 'PUT', url: `/bids/${bid.id}/accept` });
      const loadCode = res?.loadCode || bid.loadCode || load?.code || null;
      const payload = { ...res, loadCode };
      commitOptimisticBidAccept(bid.id, payload, {
        loadCode,
        carrierId: bid.carrierId,
        origin: load?.origin || bid.origin || null,
        destination: load?.destination || bid.destination || null,
        userId: user?.id,
        role: user?.activeRole
      });
      await triggerAcceptActivationSync(payload, {
        userId: user?.id,
        role: user?.activeRole
      });
      notifySuccess(t('flowSession.bidFlowStarted'));
      void fetchData();
    } catch (error) {
      notifyError(formatUserError(error, t, { fallback: t('pages.bids.acceptFailed') }));
    }
  };

  const handleReject = async (bid) => {
    try {
      commitOptimisticBidReject(bid.id, { loadCode: bid.loadCode || load?.code });
      await request({ method: 'PUT', url: `/bids/${bid.id}/reject` });
      notifyBidRejected(t('pages.bids.bidRejected'));
      void fetchData();
    } catch (error) {
      notifyError(formatUserError(error, t, { fallback: t('pages.bids.rejectFailed') }));
    }
  };

  const handleSuggest = async (bid, amount) => {
    try {
      commitOptimisticBidSuggest(bid.id, amount, {
        suggestedBy: 'shipper',
        loadCode: bid.loadCode || load?.code
      });
      await request({ method: 'PUT', url: `/bids/${bid.id}/suggest`, data: { amount } });
      notifyCounterOffer(t('pages.bids.suggestSent', { amount: Number(amount).toLocaleString() }));
      void fetchData();
    } catch (error) {
      notifyError(formatUserError(error, t, { fallback: t('pages.bids.suggestFailed') }));
    }
  };

  const handleDeleteLoad = async () => {
    try {
      await request({ method: 'DELETE', url: `/loads/${id}` });
      notifySuccess(t('pages.loads.loadDeleted'));
      navigate('/loads/manage');
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.loads.failedDeleteLoad') }));
    }
  };

  if (loading) {
    return (
      <div className="container py-3">
        <SkeletonCard rows={2} />
        <div className="mt-3">
          <SkeletonCard rows={5} />
        </div>
      </div>
    );
  }
  if (!load) return <div className="container py-3 text-muted">{t('pages.loads.failedLoadDetail')}</div>;

  const isOpen = load.status === 'open';

  return (
    <div className="container py-3">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to={activeRole === 'shipper' ? '/loads/manage' : '/loads/manage?tab=marketplace&sub=loads'}>{t('common.loads')}</Link>
          </li>
          <li className="breadcrumb-item active">
            {t('pages.loads.loadDetails')} {load.code}
          </li>
        </ol>
      </nav>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <h5 className="mb-0">
          {t('pages.loads.loadDetails')} {load.code}
        </h5>
        {isOwner ? (
          <span className="badge text-bg-primary align-self-center">
            {t('pages.bids.bidManagementTitle')} · {bids.length}
          </span>
        ) : Number(load?.bidCount ?? 0) > 0 ? (
          <span className="badge text-bg-secondary align-self-center">
            {load.bidCount} bids
          </span>
        ) : null}
        {isOwner && isOpen && (
          <div className="d-flex gap-2 flex-wrap">
            <Link to={`/loads/${load.id}/edit`}>
              <Button variant="outline-primary" className="btn-sm rounded-lg">
                {t('pages.loads.edit')}
              </Button>
            </Link>
            <Button variant="outline-danger" className="btn-sm rounded-lg" onClick={() => setShowDelete(true)}>
              {t('pages.loads.delete')}
            </Button>
          </div>
        )}
      </div>
      <LoadCard
        load={{
          ...load,
          bidCount: isOwner ? (bids?.length ?? 0) : Number(load?.bidCount ?? load?.bid_count ?? 0)
        }}
        ratingMap={ratingMap}
        ratingsLoading={ratingsLoading}
      />
      <Card className="p-3 mt-3 tp-pipeline-card">
        <h6 className="small text-muted text-uppercase mb-2">{t('bidTimeline.title')}</h6>
        <BidTimeline
          load={load}
          bids={bids}
          highlightStepId={null}
        />
      </Card>

      {isOwner && (
        <>
          <h6 className="mt-4 mb-2">
            {t('pages.bids.bidManagementTitle')} ({(bids || []).length})
          </h6>
          <BidList
            bids={bids || []}
            mode="shipper"
            onAccept={handleAccept}
            onReject={handleReject}
            onSuggest={handleSuggest}
          />
        </>
      )}

      <ConfirmActionModal
        show={showDelete}
        title={t('pages.loads.deleteLoadTitle')}
        message={t('pages.loads.deleteLoadMessage')}
        confirmText={t('pages.loads.delete')}
        confirmVariant="danger"
        onClose={() => setShowDelete(false)}
        onConfirm={handleDeleteLoad}
      />
    </div>
  );
};

export default React.memo(LoadDetails);
