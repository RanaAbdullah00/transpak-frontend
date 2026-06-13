import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { invalidateRatingSummary } from '../../hooks/useReceivedRatingSummary.js';
import Loader from '../ui/Loader.jsx';
import ReviewCard from '../reviews/ReviewCard.jsx';

function RatingDistribution({ list, t }) {
  const counts = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of list) {
      const n = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0)));
      c[n] += 1;
    }
    return c;
  }, [list]);

  const max = Math.max(1, ...Object.values(counts));

  return (
    <div className="tp-profile-section rounded-4 p-3 border shadow-sm mb-3">
      <div className="small text-muted text-uppercase fw-semibold mb-2">{t('reviews.ratingBreakdown')}</div>
      {[5, 4, 3, 2, 1].map((n) => (
        <div key={n} className="d-flex align-items-center gap-2 mb-1 small">
          <span className="text-muted tp-w-rating-label">{n}★</span>
          <div className="progress flex-grow-1 rounded-pill tp-progress-md">
            <div
              className="progress-bar bg-warning tp-progress-bar"
              role="presentation"
              style={{ '--tp-progress': `${(counts[n] / max) * 100}%` }}
            />
          </div>
          <span className="text-muted text-end tp-w-rating-count">{counts[n]}</span>
        </div>
      ))}
    </div>
  );
}

function parseReviewsPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.reviews)) return data.reviews;
  return [];
}

const ProfileReviewsPanel = () => {
  const { user } = useAuth();
  const { request } = useApi();
  const { t } = useLanguage();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const uid = user?.id || user?._id;

  const sorted = useMemo(() => {
    return [...list].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [list]);

  const load = useCallback(async () => {
    if (!uid) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await request({ url: `/reviews/${uid}` });
      setList(parseReviewsPayload(data));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [uid, request]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'reviews') return;
      if (uid) invalidateRatingSummary(uid);
      load();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [load, uid]);

  if (!uid) {
    return <p className="small text-muted mb-0">{t('reviews.signInToSeeReviews')}</p>;
  }

  if (loading) {
    return (
      <div className="py-4 d-flex justify-content-center">
        <Loader />
      </div>
    );
  }

  if (!list.length) {
    return (
      <div className="tp-empty-reviews rounded-4 border border-dashed p-4 text-center">
        <div className="fw-semibold mb-1">{t('reviews.noReviewsYet')}</div>
        <p className="small text-muted mb-0">{t('reviews.noReviewsBody')}</p>
      </div>
    );
  }

  return (
    <div>
      <RatingDistribution list={list} t={t} />
      <div className="small text-muted text-uppercase fw-semibold mb-2">{t('reviews.recentTimeline')}</div>
      <ul className="list-unstyled mb-0 d-flex flex-column gap-3 tp-reviews-list">
        {sorted.map((r) => (
          <ReviewCard key={r.id || `${r.createdAt}-${r.rating}-${r.comment}`} review={r} accent />
        ))}
      </ul>
    </div>
  );
};

export default ProfileReviewsPanel;
