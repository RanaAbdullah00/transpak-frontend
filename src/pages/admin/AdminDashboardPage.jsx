import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
    { key: 'users', title: t('pages.admin.usersTitle'), value: stats?.totalUsers, hint: t('pages.admin.registeredAccounts') },
    { key: 'bookings', title: t('pages.admin.totalBookings'), value: stats?.totalBookings, hint: t('pages.admin.bookingsSub') },
    {
      key: 'loads',
      title: t('common.loads'),
      value: stats?.totalShipments ?? stats?.totalLoads,
      hint: t('pages.admin.loadRecords')
    },
    {
      key: 'shipments',
      title: t('pages.admin.activeShipments'),
      value: stats?.activeShipments,
      hint: t('pages.admin.assignedInTransit')
    },
    { key: 'bids', title: t('pages.bids.bidManagementTitle'), value: stats?.totalBids, hint: t('pages.admin.bidsPlaced') },
    { key: 'reviews', title: t('pages.admin.reviewsStored'), value: stats?.totalReviews, hint: t('pages.admin.reviewsHint') }
  ];

  const chartRows = useMemo(() => {
    if (!stats) return [];
    const entries = [
      { label: t('common.loads'), n: Number(stats.totalShipments ?? stats.totalLoads ?? 0) },
      { label: t('pages.admin.activeShipments'), n: Number(stats.activeShipments ?? 0) },
      { label: t('pages.bids.bidManagementTitle'), n: Number(stats.totalBids ?? 0) },
      { label: t('pages.admin.usersTitle'), n: Number(stats.totalUsers ?? 0) }
    ];
    const max = Math.max(1, ...entries.map((e) => e.n));
    return entries.map((e) => ({ ...e, pct: Math.round((e.n / max) * 100) }));
  }, [stats, t]);

  const quickLinks = [
    { to: '/admin/bids', label: t('pages.admin.bidsTitle') },
    { to: '/admin/notifications', label: t('pages.admin.notificationsTitle') },
    { to: '/admin/otp-logs', label: t('pages.admin.otpLogsTitle') },
    { to: '/admin/users', label: t('nav.adminUsers') },
    { to: '/admin/shipments', label: t('nav.shipments') },
    { to: '/admin/loads', label: t('nav.adminLoads') },
    { to: '/admin/verification', label: t('nav.verification') },
    { to: '/admin/disputes', label: t('nav.disputes') },
    { to: '/admin/roles', label: t('nav.roleManagement') }
  ];

  return (
    <div className="container py-3 tp-dashboard tp-dashboard--admin">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
          <h5 className="mb-1">{t('pages.admin.dashboardTitle')}</h5>
          <p className="small text-muted mb-0">{t('pages.admin.dashboardLead')}</p>
        </div>
      </div>

      {loading && <SkeletonStatCards count={6} />}

      {!loading && fetchError && (
        <div className="alert alert-warning rounded-3 border-0 shadow-sm" role="alert">
          <div className="fw-semibold mb-1">{t('pages.admin.statsError')}</div>
          <p className="small mb-3 text-muted">{fetchError}</p>
          <button type="button" className="btn btn-primary btn-sm rounded-lg" onClick={() => window.location.reload()}>
            {t('pages.admin.tryAgain')}
          </button>
        </div>
      )}

      {!loading && !fetchError && stats && (
        <>
          <div className="row g-3 mb-4">
            {cards.map((c) => (
              <div key={c.key} className="col-6 col-lg-4">
                <div className="card border-0 shadow-sm h-100 rounded-3 overflow-hidden tp-admin-stat-card">
                  <div className="card-body py-3 py-md-4">
                    <div className="text-muted small mb-1">{c.title}</div>
                    <div className="h4 fw-bold mb-0 text-primary">{c.value ?? '—'}</div>
                    <div className="small text-body-secondary mt-2">{c.hint}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row g-3">
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm rounded-3 h-100">
                <div className="card-body">
                  <h6 className="fw-semibold mb-3">{t('pages.admin.analyticsOverview')}</h6>
                  <div className="d-flex flex-column gap-3">
                    {chartRows.map((row) => (
                      <div key={row.label}>
                        <div className="d-flex justify-content-between small mb-1">
                          <span>{row.label}</span>
                          <span className="fw-semibold">{row.n}</span>
                        </div>
                        <div className="progress tp-progress-thin rounded-pill">
                          <div
                            className="progress-bar bg-primary rounded-pill"
                            style={{ width: `${row.pct}%` }}
                            role="progressbar"
                            aria-valuenow={row.pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-3 h-100">
                <div className="card-body">
                  <h6 className="fw-semibold mb-3">{t('pages.admin.quickActions')}</h6>
                  <div className="d-grid gap-2">
                    {quickLinks.map((link) => (
                      <Link key={link.to} to={link.to} className="btn btn-outline-primary btn-sm rounded-lg text-start">
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboardPage;
