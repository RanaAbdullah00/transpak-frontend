import React, { useEffect, useState } from 'react';
import { SkeletonStatCards } from '../../components/ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { formatUserError } from '../../utils/userErrors.js';

const AdminDashboardPage = () => {
  const { request } = useApi();
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setFetchError(null);
        const data = await request({ url: '/admin/stats' });
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) {
          setFetchError(formatUserError(e, t, { fallback: t('pages.admin.statsError') }));
          setStats(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request, t]);

  const cards = [
    { title: t('pages.admin.usersTitle'), value: stats?.totalUsers ?? '—', hint: t('pages.admin.registeredAccounts') },
    { title: t('pages.admin.totalBookings'), value: stats?.totalBookings ?? '—', hint: t('pages.admin.bookingsSub') },
    { title: t('common.loads'), value: stats?.totalShipments ?? stats?.totalLoads ?? '—', hint: t('pages.admin.loadRecords') },
    {
      title: t('pages.admin.activeShipments'),
      value: stats?.activeShipments ?? '—',
      hint: t('pages.admin.assignedInTransit')
    },
    { title: t('pages.bids.bidManagementTitle'), value: stats?.totalBids ?? '—', hint: t('pages.admin.bidsPlaced') },
    { title: t('pages.admin.reviewsStored'), value: stats?.totalReviews ?? '—', hint: t('pages.admin.reviewsHint') }
  ];

  return (
    <div className="container py-3">
      <h5 className="mb-4">{t('pages.admin.dashboardTitle')}</h5>

      {loading && <SkeletonStatCards count={6} />}

      {!loading && fetchError && (
        <div className="alert alert-warning rounded-3 border-0 shadow-sm" role="alert">
          <div className="fw-semibold mb-1">{t('pages.admin.statsError')}</div>
          <p className="small mb-3 text-muted">{fetchError}</p>
          <button
            type="button"
            className="btn btn-primary btn-sm rounded-lg"
            onClick={() => window.location.reload()}
          >
            {t('pages.admin.tryAgain')}
          </button>
        </div>
      )}

      {!loading && !fetchError && stats && (
        <div className="row g-3">
          {cards.map((c) => (
            <div key={`${c.title}::${c.hint}`} className="col-12 col-md-6 col-xl-4">
              <div className="card border-0 shadow-sm h-100 rounded-3 overflow-hidden">
                <div className="card-body py-4">
                  <div className="text-muted small mb-1">{c.title}</div>
                  <div className="h4 fw-bold mb-0 text-primary">{c.value}</div>
                  <div className="small text-body-secondary mt-2">{c.hint}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
