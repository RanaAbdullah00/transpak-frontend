import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import { useSafeInterval } from '../../hooks/useSafeInterval.js';
import { useNavigate } from 'react-router-dom';
import { SkeletonStatCards } from '../../components/ui/Skeleton.jsx';
import AdminDemoVideoManager from '../../components/admin/AdminDemoVideoManager.jsx';
import AdminWidgetShell from '../../components/admin/AdminWidgetShell.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useAdminDashboardWidgets } from '../../hooks/useAdminDashboardWidgets.js';
import { AppContext } from '../../context/AppContext.jsx';
import { canAccessAdminRoutes } from '../../utils/authSession.js';
import { formatLoadDisplayId } from '../../utils/displayId.js';
import { describeAdminWidgetError } from '../../utils/adminWidgetErrors.js';
import { formatStatValue } from '../../utils/formatStat.js';

const POLL_MS = 28000;

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
  const navigate = useNavigate();
  const { user, roleSwitching } = useAuth();
  const { request } = useApi();
  const { t, isUrdu } = useLanguage();
  const locale = isUrdu ? 'ur-PK' : 'en-PK';
  const { live, widgetState, initialLoading, loadAll, retryWidget, widgetFailed, widgetLoading, anyOk, authRequired } =
    useAdminDashboardWidgets(request);
  const { socketStatus } = useContext(AppContext) || {};

  const adminReady =
    canAccessAdminRoutes(user) && user?.activeRole === 'admin' && !roleSwitching;

  useEffect(() => {
    if (!adminReady) return;
    loadAll();
  }, [loadAll, adminReady]);

  useEffect(() => {
    let timer = null;
    const onRefresh = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => loadAll(), 1200);
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('tp:realtime-refresh', onRefresh);
    };
  }, [loadAll]);

  useSafeInterval(() => loadAll(), POLL_MS, { enabled: adminReady && socketStatus !== 'connected' });

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

  const activity = useMemo(() => {
    const items = [];
    const loadsOk = !widgetFailed('loads');
    const bidsOk = !widgetFailed('bids');
    const shipmentsOk = !widgetFailed('shipments');

    if (loadsOk) {
      (live?.recentLoads || []).forEach((r) => {
        items.push({
          id: `load-${r.id}`,
          ts: r.createdAt,
          label: t('pages.admin.activityLoadPosted'),
          detail: `${formatLoadDisplayId(r)} · ${r.origin} → ${r.destination}`,
          meta: r.shipperName
        });
      });
    }
    if (bidsOk) {
      (live?.recentBids || []).forEach((r) => {
        items.push({
          id: `bid-${r.id}`,
          ts: r.createdAt,
          label: t('pages.admin.activityBid'),
          detail: `${formatLoadDisplayId({ code: r.loadCode })} · PKR ${r.amount}`,
          meta: r.carrierName
        });
      });
    }
    if (shipmentsOk) {
      (live?.recentShipments || []).forEach((r) => {
        items.push({
          id: `shp-${r.id}`,
          ts: r.updatedAt,
          label: t('pages.admin.activityShipment'),
          detail: `${formatLoadDisplayId({ code: r.loadCode })} · ${r.status}`,
          meta: null
        });
      });
    }
    return items
      .filter((x) => x.ts)
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 20);
  }, [live, t, widgetFailed]);

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
          onClick={() => loadAll()}
          disabled={initialLoading}
        >
          {t('pages.admin.refreshNow')}
        </button>
      </div>

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
                    <div className="text-muted small mb-1">{c.title}</div>
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

      <div className="card border-0 shadow-sm rounded-3 mb-4">
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
                  <span className="text-muted d-block">{t('pages.admin.openLoads')}</span>
                  <span className="fw-semibold">
                    {formatStatValue(stats?.openLoads, { failed: widgetFailed('loads') })}
                  </span>
                </div>
                <div className="col-6 col-md-3">
                  <span className="text-muted d-block">{t('pages.admin.completedShipments')}</span>
                  <span className="fw-semibold">
                    {formatStatValue(stats?.completedShipments, { failed: widgetFailed('shipments') })}
                  </span>
                </div>
              </div>
            ) : null}
          </AdminWidgetShell>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body">
              <AdminWidgetShell
                title={t('pages.admin.auditLogTitle')}
                loading={widgetLoading('audit')}
                error={widgetFailed('audit') ? describeAdminWidgetError(widgetState?.audit, t) : null}
                onRetry={() => retryWidget('audit')}
              >
                {(live?.auditEvents ?? []).length === 0 ? (
                  <p className="small text-muted mb-0">{t('pages.admin.auditLogEmpty')}</p>
                ) : (
                  <ul className="list-group list-group-flush tp-admin-activity-list mb-0">
                    {(live?.auditEvents ?? []).map((ev) => (
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
              </AdminWidgetShell>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body">
              <AdminWidgetShell
                title={t('pages.admin.recentActivity')}
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
              >
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
              </AdminWidgetShell>
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
