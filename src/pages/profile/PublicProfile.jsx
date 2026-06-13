import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Loader from '../../components/ui/Loader.jsx';
import ReviewCard from '../../components/reviews/ReviewCard.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { invalidateRatingSummary } from '../../hooks/useReceivedRatingSummary.js';
import { translateRoleLabel } from '../../utils/i18nLabels.js';
import SafeAvatar from '../../components/ui/SafeAvatar.jsx';
import SafeImage from '../../components/ui/SafeImage.jsx';
import VehicleTypeLabel from '../../components/loadboard/VehicleTypeLabel.jsx';

function parseReviewsPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.reviews)) return data.reviews;
  return [];
}

const PublicProfile = () => {
  const { id } = useParams();
  const { t } = useLanguage();
  const { request } = useApi();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadReviews = useCallback(async () => {
    if (!id) return;
    try {
      const r = await request({ url: `/reviews/${id}` });
      setReviews(parseReviewsPayload(r));
    } catch {
      setReviews([]);
    }
  }, [id, request]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, r] = await Promise.all([
          request({ url: `/profile/${id}` }),
          request({ url: `/reviews/${id}` })
        ]);
        if (!cancelled) {
          setProfile(p);
          setReviews(parseReviewsPayload(r));
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setReviews([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, request]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'reviews') return;
      if (id) invalidateRatingSummary(id);
      loadReviews();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [id, loadReviews]);

  if (loading) {
    return (
      <div className="container py-5 d-flex justify-content-center">
        <Loader />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container py-4 text-muted">
        {t('publicProfile.notFound')}
      </div>
    );
  }

  const role = profile.activeRole || profile.roles?.[0];

  return (
    <div className="container py-3 tp-public-profile">
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb mb-0">
          <li className="breadcrumb-item">
            <Link to="/">{t('common.home')}</Link>
          </li>
          <li className="breadcrumb-item active">{profile.fullName}</li>
        </ol>
      </nav>

      <Card className="p-4 mb-3">
        <div className="d-flex flex-wrap gap-3 align-items-start">
          <div className="tp-avatar-lg rounded-circle overflow-hidden border flex-shrink-0">
            <SafeAvatar
              src={profile.profileImage}
              name={profile.fullName}
              fallbackClassName="tp-avatar-placeholder d-flex align-items-center justify-content-center h-100 w-100 fw-bold"
            />
          </div>
          <div className="flex-grow-1 min-w-0">
            <h4 className="mb-1">{profile.fullName}</h4>
            <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
              <span className="tp-role-badge">{translateRoleLabel(t, role)}</span>
              {profile.verified ? (
                <span className="badge bg-success-subtle text-success">{t('publicProfile.verified')}</span>
              ) : null}
            </div>
            <div className="small text-muted mb-2">
              ★ {Number(profile.ratingAverage || 0).toFixed(1)} · {profile.ratingCount || 0} {t('publicProfile.reviews')}
              {profile.completionRate != null ? (
                <span className="ms-2">· {profile.completionRate}% {t('publicProfile.completionRate')}</span>
              ) : null}
            </div>
            <div className="mb-2">
              <span className={`badge ${profile.isActiveNow ? 'text-bg-success' : 'text-bg-secondary'}`}>
                {profile.isActiveNow ? t('publicProfile.activeNow') : t('publicProfile.inactiveRecently')}
              </span>
            </div>
            <div className="row g-2 small">
              <div className="col-6 col-md-3">
                <div className="tp-stat-pill">{t('publicProfile.active')}</div>
                <div className="fw-semibold">{profile.activeDeliveries ?? 0}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="tp-stat-pill">{t('publicProfile.completed')}</div>
                <div className="fw-semibold">{profile.completedDeliveries ?? 0}</div>
              </div>
              {profile.phone ? (
                <>
                  <div className="col-12 col-md-6">
                    <div className="tp-stat-pill">{t('publicProfile.phone')}</div>
                    <div className="fw-semibold">{profile.phone}</div>
                  </div>
                  {profile.whatsapp && !profile.whatsappLocked ? (
                    <div className="col-12 col-md-6">
                      <div className="tp-stat-pill">{t('publicProfile.whatsapp')}</div>
                      <div className="fw-semibold">{profile.whatsapp}</div>
                    </div>
                  ) : null}
                </>
              ) : profile.phoneLocked ? (
                <div className="col-12 col-md-6 text-muted small">{t('publicProfile.phoneLocked')}</div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {profile.trucks?.length > 0 ? (
        <Card className="p-3 mb-3">
          <h6 className="mb-3">{t('publicProfile.truckGallery')}</h6>
          <div className="row g-2">
            {profile.trucks.map((tr) => (
              <div key={tr.id} className="col-6 col-md-4">
                <div className="tp-truck-thumb rounded-3 overflow-hidden border">
                  {tr.truckCardFrontImage ? (
                    <SafeImage
                      src={tr.truckCardFrontImage}
                      alt=""
                      className="tp-img-cover tp-truck-thumb__img"
                      fallback={
                        <div className="tp-truck-thumb__placeholder small text-muted p-3">
                          <VehicleTypeLabel value={tr.truckType} />
                        </div>
                      }
                    />
                  ) : (
                    <div className="tp-truck-thumb__placeholder small text-muted p-3">
                      <VehicleTypeLabel value={tr.truckType} />
                    </div>
                  )}
                  <div className="small p-2">
                    <VehicleTypeLabel value={tr.truckType} /> · {tr.licensePlate}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="p-3">
        <h6 className="mb-3">{t('publicProfile.reviewsTitle')}</h6>
        {reviews.length === 0 ? (
          <p className="text-muted small mb-0">{t('reviews.noReviewsYet')}</p>
        ) : (
          <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default PublicProfile;
