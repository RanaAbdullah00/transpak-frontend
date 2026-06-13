import React, { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { normalizeBids } from '../../adapters/normalize.js';
import { mergeWorkspaceParams } from '../../utils/workspaceApi.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { invalidateRatingSummary } from '../../hooks/useReceivedRatingSummary.js';
import { emitRealtimeRefresh } from '../../utils/realtimeRefresh.js';
import StarPicker from '../reviews/StarPicker.jsx';
import { isReviewDismissed, markReviewDismissed } from '../../utils/reviewDismissStore.js';
import { canRenderReview, reviewRenderGuard } from '../../utils/reviewRenderGuard.js';

/** Post-delivery / closure only (InDrive-style). */
function loadAllowsRating(load) {
  const s = String(load?.status || '').toLowerCase();
  return s === 'delivered' || s === 'closed';
}

function loadStatusLabel(t, status) {
  const s = String(status || '').toLowerCase();
  const map = {
    open: 'pages.loads.statusOpen',
    booked: 'pages.pipeline.booked',
    assigned: 'pages.loads.statusAssigned',
    delivered: 'pages.pipeline.delivered',
    closed: 'pages.pipeline.closed'
  };
  const key = map[s];
  if (!key) return status || '—';
  const tr = t(key);
  return tr === key ? status || '—' : tr;
}

function StarPickerLocal({ value, onChange, disabled }) {
  return <StarPicker value={value} onChange={onChange} disabled={disabled} />;
}

function RateCard({ item, onSubmitted, userId }) {
  const { t } = useLanguage();
  const { request } = useApi();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = item.rateEnabled === true && !submitted;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await request({
        method: 'POST',
        url: '/reviews',
        data: {
          toUser: item.toUserId,
          rating: Number(rating),
          comment: comment.trim() || undefined,
          loadId: item.loadId
        }
      });
      notifySuccess(t('reviews.submitted'));
      invalidateRatingSummary(item.toUserId);
      emitRealtimeRefresh('all');
      markReviewDismissed(userId, { loadId: item.loadId });
      reviewRenderGuard(`load:${item.loadId}`).lock();
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('reviews.submitFailed') }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`tp-rate-card rounded-4 p-3 border shadow-sm ${!canSubmit ? 'opacity-90' : ''}`}
      title={!canSubmit ? t('reviews.rateOnlyWorkedWith') : undefined}
    >
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <div className="min-w-0">
          <div className="fw-semibold text-break">{item.label}</div>
          <div className="small text-muted">
            {t('reviews.counterpartyRole')}: {item.counterpartyRoleLabel}
          </div>
        </div>
        <span className="badge rounded-pill bg-body-secondary text-body small text-wrap">
          {loadStatusLabel(t, item.loadStatus)}
        </span>
      </div>
      <div className="small text-muted mb-2 text-break">
        {t('reviews.loadContext')}: <span className="text-body">{item.loadCode || item.loadId?.slice(0, 8) || '—'}</span>
      </div>
      {!submitted && !item.rateEnabled ? (
        <div className="alert alert-secondary border-0 rounded-3 small py-2 mb-0" role="status">
          {t('reviews.rateUnlockAfterDelivery')}
        </div>
      ) : submitted ? (
        <div className="alert alert-success border-0 rounded-3 small py-2 mb-0" role="status">
          {t('reviews.submitted')}
        </div>
      ) : (
        <>
          <div className="mb-2">
            <span className="small fw-semibold d-block mb-1">{t('reviews.yourRating')}</span>
            <StarPickerLocal value={rating} onChange={setRating} disabled={busy} />
          </div>
          <label className="form-label small mb-1">{t('reviews.optionalComment')}</label>
          <textarea
            className="form-control form-control-sm mb-3"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            disabled={busy}
          />
          <Button variant="primary" size="sm" className="rounded-lg" onClick={submit} disabled={busy}>
            {busy ? t('common.loading') : t('reviews.submitRate')}
          </Button>
        </>
      )}
    </div>
  );
}

const ProfileRateUsersPanel = () => {
  const { user } = useAuth();
  const { request } = useApi();
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const role = user?.activeRole ?? user?.roles?.[0];
  const uid = user?.id || user?._id;

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (role === 'shipper') {
          const data = await request({ url: '/bids', params: mergeWorkspaceParams(user) });
          const bids = normalizeBids(data).filter((b) => b.status === 'accepted' && b.carrierId && b.loadId);
          const seen = new Set();
          const next = [];
          for (const b of bids) {
            const k = `${b.loadId}:${b.carrierId}`;
            if (seen.has(k)) continue;
            let load = null;
            try {
              load = await request({ url: `/loads/${b.loadId}` });
            } catch {
              continue;
            }
            if (!load) continue;
            if (String(load.assignedCarrierId || '') !== String(b.carrierId)) continue;
            seen.add(k);
            const rateEnabled = loadAllowsRating(load);
            next.push({
              key: k,
              loadId: b.loadId,
              loadCode: load?.code || '',
              loadStatus: load?.status || '',
              toUserId: String(b.carrierId),
              label: b.carrierName || t('auth.carrier'),
              counterpartyRoleLabel: t('auth.carrier'),
              rateEnabled
            });
          }
          if (!cancelled) {
            setItems(
              next.filter(
                (item) =>
                  !isReviewDismissed(uid, { loadId: item.loadId }) &&
                  canRenderReview(`load:${item.loadId}`)
              )
            );
          }
        } else if (role === 'carrier') {
          const data = await request({ method: 'GET', url: '/bids/mine' });
          const bids = normalizeBids(data).filter((b) => b.status === 'accepted' && b.loadId);
          const seen = new Set();
          const next = [];
          for (const b of bids) {
            let load = null;
            try {
              load = await request({ url: `/loads/${b.loadId}` });
            } catch {
              continue;
            }
            const shipperId = load?.shipperId;
            if (!shipperId || String(shipperId) === String(uid)) continue;
            if (String(load.assignedCarrierId || '') !== String(uid)) continue;
            const k = `${b.loadId}:${shipperId}`;
            if (seen.has(k)) continue;
            seen.add(k);
            const rateEnabled = loadAllowsRating(load);
            next.push({
              key: k,
              loadId: b.loadId,
              loadCode: load?.code || '',
              loadStatus: load?.status || '',
              toUserId: String(shipperId),
              label: `${t('auth.shipper')} · ${load?.code || b.loadId.slice(0, 8)}`,
              counterpartyRoleLabel: t('auth.shipper'),
              rateEnabled
            });
          }
          if (!cancelled) {
            setItems(
              next.filter(
                (item) =>
                  !isReviewDismissed(uid, { loadId: item.loadId }) &&
                  canRenderReview(`load:${item.loadId}`)
              )
            );
          }
        } else if (!cancelled) {
          setItems([]);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, role, request, t, tick]);

  if (!uid) {
    return <p className="small text-muted mb-0">{t('reviews.signInToRate')}</p>;
  }

  if (role !== 'shipper' && role !== 'carrier') {
    return <p className="small text-muted mb-0">{t('reviews.rateAsShipperOrCarrier')}</p>;
  }

  if (loading) {
    return (
      <div className="py-4 d-flex justify-content-center">
        <Loader />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="tp-empty-reviews rounded-4 border border-dashed p-4 text-center">
        <div className="fw-semibold mb-1">{t('reviews.noWorkedWithYet')}</div>
        <p className="small text-muted mb-0">{t('reviews.noWorkedWithBody')}</p>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <p className="small text-muted mb-0">{t('reviews.rateUsersHintStrict')}</p>
      {items.map((item) => (
        <RateCard key={item.key} item={item} userId={uid} onSubmitted={() => setTick((x) => x + 1)} />
      ))}
    </div>
  );
};

export default ProfileRateUsersPanel;
