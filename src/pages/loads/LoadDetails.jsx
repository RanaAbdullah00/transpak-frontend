import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LoadCard from '../../components/loadboard/LoadCard.jsx';
import ProfileLink from '../../components/profile/ProfileLink.jsx';
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
  notifyBidAccepted,
  notifyBidRejected,
  notifyCounterOffer
} from '../../components/ui/ToastProvider.jsx';
import { normalizeLoads, normalizeBids } from '../../adapters/normalize.js';
import { formatUserError } from '../../utils/userErrors.js';

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
    () => activeRole === 'shipper' && load && String(load.shipperId) === String(uid),
    [activeRole, load, uid]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const loadPromise = request({ url: `/loads/${id}` });
      const bidsPromise =
        activeRole === 'shipper'
          ? request({ url: '/bids', params: { loadId: id } })
          : Promise.resolve([]);
      const [raw, bidRows] = await Promise.all([loadPromise, bidsPromise]);
      const normalizedLoads = normalizeLoads([raw]);
      setLoad(normalizedLoads[0] || null);
      setBids(activeRole === 'shipper' ? normalizeBids(bidRows) : []);
    } catch (error) {
      notifyError(formatUserError(error, t, { fallback: t('pages.loads.failedLoadDetail') }));
      setLoad(null);
      setBids([]);
    } finally {
      setLoading(false);
    }
  }, [id, request, activeRole, t]);

  useEffect(() => {
    if (!id || !user) return;
    fetchData();
  }, [id, user?.id, fetchData]);

  const handleAccept = async (bid) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/accept` });
      setBids((prev) =>
        prev.map((b) =>
          b.id === bid.id ? { ...b, status: 'accepted', flowStatus: 'ACCEPTED' } : { ...b, status: 'rejected' }
        )
      );
      notifyBidAccepted(t('pages.bids.bidAccepted'));
      fetchData();
    } catch (error) {
      notifyError(formatUserError(error, t, { fallback: t('pages.bids.acceptFailed') }));
    }
  };

  const handleReject = async (bid) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/reject` });
      setBids((prev) => prev.map((b) => (b.id === bid.id ? { ...b, status: 'rejected' } : b)));
      notifyBidRejected(t('pages.bids.bidRejected'));
    } catch (error) {
      notifyError(formatUserError(error, t, { fallback: t('pages.bids.rejectFailed') }));
    }
  };

  const handleSuggest = async (bid, amount) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/suggest`, data: { amount } });
      setBids((prev) =>
        prev.map((b) =>
          b.id === bid.id ? { ...b, status: 'suggested', suggestedAmount: amount, suggestedBy: 'shipper' } : b
        )
      );
      notifyCounterOffer(t('pages.bids.suggestSent', { amount: Number(amount).toLocaleString() }));
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
  const approvedBid = bids.find((b) => b.status === 'accepted');

  return (
    <div className="container py-3">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to={activeRole === 'shipper' ? '/loads/manage' : '/loads/manage?tab=freight'}>{t('common.loads')}</Link>
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
      <LoadCard load={load} />
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
            {t('pages.bids.bidManagementTitle')} ({bids.length})
          </h6>
          <BidList
            bids={bids}
            mode="shipper"
            onAccept={handleAccept}
            onReject={handleReject}
            onSuggest={handleSuggest}
          />
          {approvedBid && (
            <div className="alert alert-success mt-3 rounded-lg border-0">
              {t('pages.bids.shipmentAssignedPrefix')}{' '}
              <ProfileLink
                userId={approvedBid.carrierId}
                name={approvedBid.carrierName || t('auth.carrier')}
                showBadge
                role={t('auth.carrier')}
              />
            </div>
          )}
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
