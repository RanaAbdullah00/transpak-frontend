import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeInterval } from '../../hooks/useSafeInterval.js';
import { Link } from 'react-router-dom';
import { SkeletonStatCards } from '../../components/ui/Skeleton.jsx';
import AdminDemoVideoManager from '../../components/admin/AdminDemoVideoManager.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { formatUserError } from '../../utils/userErrors.js';
import { formatLoadDisplayId } from '../../utils/displayId.js';

const POLL_MS = 28000;

function formatWhen(iso, locale) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch {
    return String(iso);
  }
}

const AdminDashboardPage = () => {
  const { request } = useApi();
  const { t, isUrdu } = useLanguage();
  const locale = isUrdu ? 'ur-PK' : 'en-PK';
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadLive = useCallback(async () => {
    try {
      setFetchError(null);
      const data = await request({ url: '/admin/dashboard/live', skipGlobalErrorToast: true });
      if (!mountedRef.current) return;
      setLive(data);
    } catch (e) {
      if (!mountedRef.current) return;
      setFetchError(formatUserError(e, t, { fallback: t('pages.admin.statsError') }));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [request, t]);

  useEffect(() => {
    const onRefresh = () => loadLive();
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [loadLive]);

  useSafeInterval(loadLive, POLL_MS, { enabled: true });

  const stats = live?.stats;

  const cards = useMemo(
    () => [
      { key: 'users', title: t('pages.admin.usersTitle'), value: stats?.totalUsers, hint: t('pages.admin.registeredAccounts') },
      { key: 'openLoads', title: t('pages.admin.openLoads'), value: stats?.openLoads, hint: t('pages.admin.openLoadsHint') },
      { key: 'bids', title: t('pages.bids.bidManagementTitle'), value: stats?.totalBids, hint: t('pages.admin.bidsPlaced') },
      {
        key: 'shipments',
        title: t('pages.admin.activeShipments'),
        value: stats?.activeShipments,
        hint: t('pages.admin.assignedInTransit')
      },
      {
        key: 'completed',
        title: t('pages.admin.completedShipments'),
        value: stats?.completedShipments,
        hint: t('pages.admin.completedShipmentsHint')
      },
      {
        key: 'notifToday',
        title: t('pages.admin.notificationsToday'),
        value: stats?.notificationsToday,
        hint: t('pages.admin.notificationsTodayHint')
      },
      { key: 'disputes', title: t('nav.disputes'), value: stats?.openDisputes, hint: t('pages.admin.openDisputesHint') },
      {
        key: 'verification',
        title: t('nav.verification'),
        value: stats?.pendingVerification,
        hint: t('pages.admin.pendingVerificationHint')
      },
      { key: 'shippers', title: t('pages.admin.shipperAccounts'), value: stats?.shipperAccounts, hint: t('pages.admin.shipperAccountsHint') },
      { key: 'carriers', title: t('pages.admin.carrierAccounts'), value: stats?.carrierAccounts, hint: t('pages.admin.carrierAccountsHint') },
      {
        key: 'profiles',
        title: t('pages.admin.incompleteProfiles'),
        value: stats?.incompleteProfiles,
        hint: t('pages.admin.incompleteProfilesHint')
      },
      { key: 'trucks', title: t('pages.admin.registeredTrucks'), value: stats?.registeredTrucks, hint: t('pages.admin.registeredTrucksHint') }
    ],
    [stats, t]
  );

  const quickLinks = [
    { to: '/admin/users', label: t('nav.adminUsers') },
    { to: '/admin/bids', label: t('pages.admin.bidsTitle') },
    { to: '/admin/verification', label: t('nav.verification') },
    { to: '/admin/disputes', label: t('nav.disputes') },
    { to: '/admin/loads', label: t('nav.adminModeration') },
    { to: '/admin/shipments', label: t('nav.shipments') },
    { to: '/admin/notifications', label: t('pages.admin.notificationsTitle') },
    { to: '/admin/otp-logs', label: t('nav.adminReports') },
    { to: '/admin/roles', label: t('nav.roleManagement') }
  ];

  const activity = useMemo(() => {
    const items = [];
    (live?.recentLoads || []).forEach((r) => {
      items.push({
        id: `load-${r.id}`,
        ts: r.createdAt,
        label: t('pages.admin.activityLoadPosted'),
        detail: `${formatLoadDisplayId(r)} · ${r.origin} → ${r.destination}`,
        meta: r.shipperName
      });
    });
    (live?.recentBids || []).forEach((r) => {
      items.push({
        id: `bid-${r.id}`,
        ts: r.createdAt,
        label: t('pages.admin.activityBid'),
        detail: `${formatLoadDisplayId({ code: r.loadCode })} · PKR ${r.amount}`,
        meta: r.carrierName
      });
    });
    (live?.recentShipments || []).forEach((r) => {
      items.push({
        id: `shp-${r.id}`,
        ts: r.updatedAt,
        label: t('pages.admin.activityShipment'),
        detail: `${formatLoadDisplayId({ code: r.loadCode })} · ${r.status}`,
        meta: null
      });
    });
  return items
      .filter((x) => x.ts)
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 20);
  }, [live, t]);

  return (
    <div className="container py-3 tp-dashboard tp-dashboard--admin">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h5 className="mb-1">{t('pages.admin.dashboardTitle')}</h5>
          <p className="small text-muted mb-0">{t('pages.admin.dashboardLead')}</p>
          {stats?.generatedAt ? (
            <p className="small text-muted mb-0 mt-1">
              {t('pages.admin.lastUpdated')}: {formatWhen(stats.generatedAt, locale)}
            </p>
          ) : null}
        </div>
        <button type="button" className="btn btn-outline-primary btn-sm rounded-lg" onClick={loadLive} disabled={loading}>
          {t('pages.admin.refreshNow')}
        </button>
      </div>

      {loading && !live && <SkeletonStatCards count={6} />}

      {!loading && fetchError && !live && (
        <div className="alert alert-warning rounded-3 border-0 shadow-sm" role="alert">
          <div className="fw-semibold mb-1">{t('pages.admin.statsError')}</div>
          <p className="small mb-3 text-muted">{fetchError}</p>
          <button type="button" className="btn btn-primary btn-sm rounded-lg" onClick={loadLive}>
            {t('pages.admin.tryAgain')}
          </button>
        </div>
      )}

      {live && (
        <>
          <div className="row g-3 mb-4">
            {cards.map((c) => (
              <div key={c.key} className="col-6 col-lg-4 col-xl-3">
                <div className="card border-0 shadow-sm h-100 rounded-3 tp-admin-stat-card">
                  <div className="card-body py-3">
                    <div className="text-muted small mb-1">{c.title}</div>
                    <div className="h4 fw-bold mb-0 text-primary">{c.value ?? '—'}</div>
                    <div className="small text-body-secondary mt-2">{c.hint}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {live.observability ? (
            <div className="card border-0 shadow-sm rounded-3 mb-4">
              <div className="card-body py-3">
                <h6 className="fw-semibold mb-3">{t('pages.admin.observabilityTitle')}</h6>
                <div className="row g-2 small">
                  <div className="col-6 col-md-3">
                    <span className="text-muted d-block">{t('pages.admin.uptime')}</span>
                    <span className="fw-semibold">
                      {Math.floor((live.observability.uptimeSeconds || 0) / 3600)}h{' '}
                      {Math.floor(((live.observability.uptimeSeconds || 0) % 3600) / 60)}m
                    </span>
                  </div>
                  <div className="col-6 col-md-3">
                    <span className="text-muted d-block">{t('pages.admin.websocketConnections')}</span>
                    <span className="fw-semibold">{live.observability.websocketConnections ?? 0}</span>
                  </div>
                  <div className="col-6 col-md-3">
                    <span className="text-muted d-block">{t('pages.admin.openLoads')}</span>
                    <span className="fw-semibold">{stats?.openLoads ?? '—'}</span>
                  </div>
                  <div className="col-6 col-md-3">
                    <span className="text-muted d-block">{t('pages.admin.completedShipments')}</span>
                    <span className="fw-semibold">{stats?.completedShipments ?? '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="row g-3 mb-4">
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm rounded-3 h-100">
                <div className="card-body">
                  <h6 className="fw-semibold mb-3">{t('pages.admin.auditLogTitle')}</h6>
                  {!live.auditEvents?.length ? (
                    <p className="small text-muted mb-0">{t('pages.admin.auditLogEmpty')}</p>
                  ) : (
                    <ul className="list-group list-group-flush tp-admin-activity-list mb-0">
                      {live.auditEvents.map((ev) => (
                        <li key={ev.id} className="list-group-item px-0 border-0 border-bottom tp-border-theme">
                          <div className="d-flex justify-content-between gap-2">
                            <div className="min-w-0">
                              <div className="small fw-semibold text-break">{ev.action}</div>
                              <div className="small text-muted">
                                {ev.targetEntity}
                                {ev.targetId ? ` · ${String(ev.targetId).slice(0, 8)}` : ''}
                              </div>
                              <div className="small text-body-secondary">{ev.actorName}</div>
                            </div>
                            <div className="small text-muted text-nowrap flex-shrink-0">
                              {formatWhen(ev.createdAt, locale)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-3 h-100">
                <div className="card-body">
                  <h6 className="fw-semibold mb-3">{t('pages.admin.recentActivity')}</h6>
                  {!activity.length ? (
                    <p className="small text-muted mb-0">{t('pages.admin.noRecentActivity')}</p>
                  ) : (
                    <ul className="list-group list-group-flush tp-admin-activity-list">
                      {activity.map((item) => (
                        <li key={item.id} className="list-group-item px-0 border-0 border-bottom tp-border-theme">
                          <div className="d-flex justify-content-between gap-2">
                            <div className="min-w-0">
                              <div className="small fw-semibold">{item.label}</div>
                              <div className="small text-muted text-truncate">{item.detail}</div>
                              {item.meta ? <div className="small text-body-secondary">{item.meta}</div> : null}
                            </div>
                            <div className="small text-muted text-nowrap flex-shrink-0">
                              {formatWhen(item.ts, locale)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-lg-5">
              <div className="d-grid gap-3">
                <div className="card border-0 shadow-sm rounded-3">
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
                <AdminDemoVideoManager />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboardPage;
