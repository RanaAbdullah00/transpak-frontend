import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeInterval } from '../../hooks/useSafeInterval.js';
import { useNavigate, Link } from 'react-router-dom';
import { SkeletonStatCards } from '../../components/ui/Skeleton.jsx';
import AdminDemoVideoManager from '../../components/admin/AdminDemoVideoManager.jsx';
import AdminWidgetShell from '../../components/admin/AdminWidgetShell.jsx';
import AdminActivityCard from '../../components/admin/AdminActivityCard.jsx';
import AdminLiveFeedPanel from '../../components/admin/AdminLiveFeedPanel.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useAdminDashboardWidgets } from '../../hooks/useAdminDashboardWidgets.js';
import { useAdminLiveFeed, formatWhen } from '../../hooks/useAdminLiveFeed.js';
import { AppContext } from '../../context/AppContext.jsx';
import { canAccessAdminRoutes } from '../../utils/authSession.js';
import { describeAdminWidgetError } from '../../utils/adminWidgetErrors.js';
import { formatStatValue } from '../../utils/formatStat.js';
import { fetchBackendDeployDrift } from '../../utils/deployDrift.js';

const POLL_DISCONNECTED_MS = 15000;
const HEARTBEAT_MS = 60000;
const AUTO_RETRY_MS = 8000;

const CARD_WIDGET = {
  users: 'users',
  activeUsers: 'users',
  loads: 'loads',
  openLoads: 'loads',
  bids: 'bids',
  shipments: 'shipments',
  completed: 'shipments',
  disputes: 'users',
  shippers: 'users',
  carriers: 'users',
  profiles: 'users',
  trucks: 'users'
};

const CARD_LINK = {
  users: '/admin/users',
  activeUsers: '/admin/users?filter=active',
  loads: '/admin/loads',
  openLoads: '/admin/loads',
  bids: '/admin/bids',
  shipments: '/admin/shipments',
  completed: '/admin/shipments',
  disputes: '/admin/disputes',
  shippers: '/admin/users?role=shipper',
  carriers: '/admin/users?role=carrier',
  profiles: '/admin/users?filter=incomplete',
  trucks: '/admin/fleet'
};

const CARD_ICONS = {
  users: '👥',
  activeUsers: '✓',
  loads: '📦',
  openLoads: '📂',
  bids: '💰',
  shipments: '🚚',
  completed: '✅',
  disputes: '⚠️',
  shippers: '🏢',
  carriers: '🛻',
  profiles: '📝',
  trucks: '🚛'
};

const SCOPE_WIDGETS = {
  loads: ['loads'],
  bids: ['bids'],
  shipments: ['shipments', 'audit'],
  space: ['audit'],
  admin: ['users', 'observability', 'audit'],
  all: null
};

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { user, roleSwitching } = useAuth();
  const { request } = useApi();
  const { t, isUrdu } = useLanguage();
  const locale = isUrdu ? 'ur-PK' : 'en-PK';
  const {
    live,
    widgetState,
    initialLoading,
    loadAll,
    loadWidgets,
    retryWidget,
    widgetFailed,
    widgetLoading,
    connectionState,
    anyOk,
    authRequired,
    allFailed
  } = useAdminDashboardWidgets(request);
  const { socketStatus } = useContext(AppContext) || {};
  const { activity, auditEvents, markLivePulse } = useAdminLiveFeed({ live, widgetFailed, t, locale });
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [backendDeployDrift, setBackendDeployDrift] = useState(false);
  const autoRetryRef = useRef(null);

  const adminReady =
    canAccessAdminRoutes(user) && user?.activeRole === 'admin' && !roleSwitching;

  useEffect(() => {
    if (!adminReady) return;
    let cancelled = false;
    (async () => {
      const { drift } = await fetchBackendDeployDrift();
      if (!cancelled) setBackendDeployDrift(Boolean(drift));
    })();
    return () => {
      cancelled = true;
    };
  }, [adminReady]);

  const refreshDashboard = useCallback(() => {
    void fetchBackendDeployDrift().then(({ drift }) => setBackendDeployDrift(Boolean(drift)));
    void loadAll();
  }, [loadAll]);

  const refreshForScope = useCallback(
    (scope) => {
      const widgets = SCOPE_WIDGETS[scope];
      if (!widgets) {
        void loadAll();
        return;
      }
      void loadWidgets(widgets);
    },
    [loadAll, loadWidgets]
  );

  useEffect(() => {
    if (!adminReady) return;
    loadAll();
  }, [loadAll, adminReady]);

  useEffect(() => {
    const onAudit = (e) => {
      const events = e?.detail?.events;
      if (Array.isArray(events) && events.length) return;
      refreshForScope('admin');
    };
    window.addEventListener('tp:admin-audit-sync', onAudit);
    return () => window.removeEventListener('tp:admin-audit-sync', onAudit);
  }, [refreshForScope]);

  useEffect(() => {
    let timer = null;
    const onRefresh = (e) => {
      const scope = e?.detail?.scope || 'all';
      if (scope !== 'all' && !SCOPE_WIDGETS[scope]) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => refreshForScope(scope), 800);
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('tp:realtime-refresh', onRefresh);
    };
  }, [refreshForScope]);

  useSafeInterval(() => loadAll(), POLL_DISCONNECTED_MS, {
    enabled: adminReady && socketStatus !== 'connected' && !backendDeployDrift
  });

  useSafeInterval(
    () => loadWidgets(['observability', 'loads', 'bids', 'shipments']),
    HEARTBEAT_MS,
    { enabled: adminReady && socketStatus === 'connected' }
  );

  useEffect(() => {
    if (!adminReady || !allFailed || authRequired || backendDeployDrift) {
      setRetryCountdown(0);
      if (autoRetryRef.current) {
        window.clearInterval(autoRetryRef.current);
        autoRetryRef.current = null;
      }
      return undefined;
    }

    setRetryCountdown(Math.ceil(AUTO_RETRY_MS / 1000));
    autoRetryRef.current = window.setInterval(() => {
      setRetryCountdown((c) => {
        if (c <= 1) {
          void loadAll();
          return Math.ceil(AUTO_RETRY_MS / 1000);
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      if (autoRetryRef.current) {
        window.clearInterval(autoRetryRef.current);
        autoRetryRef.current = null;
      }
    };
  }, [adminReady, allFailed, authRequired, backendDeployDrift, loadAll]);

  const stats = live?.stats;
  const meta = live?.meta;

  const cards = useMemo(
    () => [
      { key: 'users', title: t('pages.admin.usersTitle'), value: stats?.totalUsers, hint: t('pages.admin.registeredAccounts') },
      {
        key: 'activeUsers',
        title: t('pages.admin.activeUsers'),
        value: stats?.activeUsers,
        hint: t('pages.admin.activeUsersHint')
      },
      { key: 'loads', title: t('pages.admin.loadsTitle'), value: stats?.totalLoads, hint: t('pages.admin.loadRecords') },
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
      { key: 'disputes', title: t('nav.disputes'), value: stats?.openDisputes, hint: t('pages.admin.openDisputesHint') },
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

  const activityWidgetsFailed =
    widgetFailed('loads') && widgetFailed('bids') && widgetFailed('shipments');
  const activityLoading =
    widgetLoading('loads') || widgetLoading('bids') || widgetLoading('shipments');

  const retryActivity = useCallback(() => {
    retryWidget('loads');
    retryWidget('bids');
    retryWidget('shipments');
  }, [retryWidget]);

  const showSkeleton = initialLoading && !anyOk;

  const openCard = (key) => {
    const to = CARD_LINK[key];
    if (to) navigate(to);
  };

  const connectionBanner =
    backendDeployDrift && allFailed && !authRequired
      ? t('pages.admin.backendUpdateInProgress')
      : allFailed && !authRequired
        ? t('pages.admin.liveFeedReconnecting')
        : connectionState === 'offline'
          ? t('pages.admin.liveFeedOffline')
          : null;

  const connectionBannerHint =
    backendDeployDrift && allFailed && !authRequired
      ? t('pages.admin.backendUpdateInProgressHint')
      : null;

  return (
    <div className="container py-3 tp-dashboard tp-dashboard--admin">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h5 className="mb-1">{t('pages.admin.dashboardTitle')}</h5>
          <p className="small text-muted mb-0">{t('pages.admin.systemMetricsHint')}</p>
          {stats?.generatedAt ? (
            <p className="small text-muted mb-0 mt-1">
              {t('pages.admin.lastUpdated')}: {formatWhen(stats.generatedAt, locale)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm rounded-lg"
          onClick={refreshDashboard}
          disabled={initialLoading}
        >
          {t('pages.admin.refreshNow')}
        </button>
      </div>

      {connectionBanner ? (
        <div className="alert alert-warning rounded-3 border-0 shadow-sm mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2" role="alert">
          <div>
            <div className="fw-semibold mb-0">{connectionBanner}</div>
            {connectionBannerHint ? (
              <p className="small text-muted mb-0 mt-1">{connectionBannerHint}</p>
            ) : null}
            {retryCountdown > 0 && !backendDeployDrift ? (
              <p className="small text-muted mb-0 mt-1">
                {t('pages.admin.tryAgain')} ({retryCountdown}s)
              </p>
            ) : null}
          </div>
          <button type="button" className="btn btn-sm btn-outline-primary rounded-lg" onClick={refreshDashboard}>
            {t('pages.admin.tryAgain')}
          </button>
        </div>
      ) : null}

      {authRequired ? (
        <div className="alert alert-warning rounded-3 border-0 shadow-sm mb-3" role="alert">
          <div className="fw-semibold mb-1">{t('pages.admin.widgetAuthError')}</div>
          <p className="small mb-0 text-muted">{t('pages.admin.widgetAuthErrorHint')}</p>
        </div>
      ) : null}

      {meta?.dbReachable === false ? (
        <div className="alert alert-danger rounded-3 border-0 shadow-sm mb-3" role="alert">
          <div className="fw-semibold mb-1">{t('pages.admin.dbUnreachable')}</div>
          <p className="small mb-0 text-muted">{t('pages.admin.dbUnreachableHint')}</p>
        </div>
      ) : null}

      {meta?.partialFailure ? (
        <div className="alert alert-warning rounded-3 border-0 shadow-sm mb-3" role="status">
          {t('pages.admin.partialStatsWarning')}
        </div>
      ) : null}

      {showSkeleton && <SkeletonStatCards count={8} />}

      <div className="row g-3 mb-4">
        {cards.map((c) => {
          const source = CARD_WIDGET[c.key] || 'users';
          const failed = widgetFailed(source);
          const loading = widgetLoading(source);
          const link = CARD_LINK[c.key];
          const CardTag = link ? 'button' : 'div';
          return (
            <div key={c.key} className="col-6 col-lg-4 col-xl-3">
              <CardTag
                type={link ? 'button' : undefined}
                className={`card border-0 shadow-sm h-100 rounded-3 tp-admin-stat-card w-100 text-start${
                  link ? ' tp-admin-stat-card--clickable' : ''
                }`}
                onClick={link ? () => openCard(c.key) : undefined}
              >
                <div className="card-body py-3">
                  <div className="d-flex justify-content-between align-items-start gap-1">
                    <div className="d-flex align-items-center gap-2 min-w-0">
                      <span className="tp-admin-stat-card__icon" aria-hidden="true">
                        {CARD_ICONS[c.key]}
                      </span>
                      <div className="text-muted small mb-0 text-truncate">{c.title}</div>
                    </div>
                    {failed ? (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          retryWidget(source);
                        }}
                        title={t('pages.admin.tryAgain')}
                      >
                        ↻
                      </button>
                    ) : null}
                  </div>
                  <div className="h4 fw-bold mb-0 text-primary">
                    {loading && failed ? (
                      <span className="placeholder col-4" />
                    ) : (
                      formatStatValue(c.value, { loading: loading && !stats, failed })
                    )}
                  </div>
                  <div className="small text-body-secondary mt-2">{c.hint}</div>
                  {failed ? (
                    <p className="small text-warning mb-0 mt-1">
                      {describeAdminWidgetError(widgetState?.[source], t)}
                    </p>
                  ) : null}
                </div>
              </CardTag>
            </div>
          );
        })}
      </div>

      <div className="card border-0 shadow-sm rounded-3 mb-4 tp-admin-stat-card">
        <div className="card-body py-3">
          <AdminWidgetShell
            title={t('pages.admin.observabilityTitle')}
            loading={widgetLoading('observability')}
            error={widgetFailed('observability') ? describeAdminWidgetError(widgetState?.observability, t) : null}
            onRetry={() => retryWidget('observability')}
          >
            {live?.observability ? (
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
                  <span className="text-muted d-block">{t('pages.admin.onlineCarriers')}</span>
                  <span className="fw-semibold">{live.observability.onlineCarriers ?? 0}</span>
                </div>
                <div className="col-6 col-md-3">
                  <span className="text-muted d-block">{t('pages.admin.openLoads')}</span>
                  <span className="fw-semibold">
                    {formatStatValue(stats?.openLoads, { failed: widgetFailed('loads') })}
                  </span>
                </div>
              </div>
            ) : null}
          </AdminWidgetShell>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-3 h-100 tp-admin-stat-card">
            <div className="card-body">
              <AdminWidgetShell
                title={t('pages.admin.auditLogTitle')}
                loading={widgetLoading('audit')}
                error={widgetFailed('audit') ? describeAdminWidgetError(widgetState?.audit, t) : null}
                onRetry={() => retryWidget('audit')}
                action={
                  <Link to="/admin/audit" className="btn btn-sm btn-link text-decoration-none">
                    {t('common.viewAll')}
                  </Link>
                }
              >
                {!auditEvents.length ? (
                  <p className="small text-muted mb-0">{t('pages.admin.auditLogEmpty')}</p>
                ) : (
                  <div className="tp-admin-dashboard-feed__body">
                    <ul className="list-unstyled tp-admin-activity-list mb-0">
                      {auditEvents.slice(0, 5).map((ev) => (
                        <AdminActivityCard
                          key={ev.id}
                          label={ev.action}
                          detail={`${ev.targetEntity}${ev.targetId ? ` · ${String(ev.targetId).slice(0, 8)}` : ''}`}
                          meta={ev.actorName}
                          timestamp={formatWhen(ev.createdAt, locale)}
                          variant="system"
                          icon="📋"
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </AdminWidgetShell>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-3 h-100 tp-admin-stat-card">
            <div className="card-body">
              <AdminLiveFeedPanel
                title={t('pages.admin.recentActivity')}
                headerAction={
                  <Link to="/admin/activity" className="btn btn-sm btn-link text-decoration-none">
                    {t('common.viewAll')}
                  </Link>
                }
                items={activity.slice(0, 5)}
                locale={locale}
                t={t}
                loading={activityLoading && !activity.length}
                error={
                  activityWidgetsFailed
                    ? describeAdminWidgetError(
                        widgetState?.loads?.error
                          ? widgetState.loads
                          : widgetState?.bids?.error
                            ? widgetState.bids
                            : widgetState?.shipments,
                        t
                      )
                    : null
                }
                onRetry={retryActivity}
                emptyMessage={t('pages.admin.noRecentActivity')}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-5">
          <AdminDemoVideoManager />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
