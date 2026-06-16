import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SegmentTabs from '../ui/SegmentTabs.jsx';
import ActiveShipmentsList from './ActiveShipmentsList.jsx';
import ShipmentHistoryPanel from './ShipmentHistoryPanel.jsx';
import SpaceSentRequestsPanel from '../carrier/SpaceSentRequestsPanel.jsx';
import SpaceRequestsPanel from '../carrier/SpaceRequestsPanel.jsx';
import ErrorBoundary from '../ui/ErrorBoundary.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const TAB_REQUEST = 'request_sent';
const TAB_ACTIVE = 'active';
const TAB_TRANSIT = 'in_transit';
const TAB_COMPLETED = 'completed';

const OperationCenterSummary = ({ carrierMode = false, ops = null, search = '', opsReady = true, tabCounts = null }) => {
  const { t } = useLanguage();
  const data = carrierMode ? ops?.carrier : ops?.shipper;
  const searchActive = Boolean(String(search || '').trim());
  const dash = t('common.emDash');
  const counts = tabCounts || {};

  const items = useMemo(
    () => {
      if (!opsReady || !data) {
        return [
          { label: t('loadsHub.opsTabRequestSent'), value: dash },
          { label: t('loadsHub.opsTabActive'), value: dash },
          { label: t('loadsHub.opsTabInTransit'), value: dash },
          { label: t('loadsHub.opsTabCompleted'), value: dash }
        ];
      }
      if (searchActive) {
        return [
          { label: t('loadsHub.opsTabRequestSent'), value: dash },
          { label: t('loadsHub.opsTabActive'), value: dash },
          { label: t('loadsHub.opsTabInTransit'), value: dash },
          { label: t('loadsHub.opsTabCompleted'), value: dash }
        ];
      }
      return [
        {
          label: t('loadsHub.opsTabRequestSent'),
          value: counts[TAB_REQUEST] ?? data.requestSentCount ?? 0
        },
        {
          label: t('loadsHub.opsTabActive'),
          value: counts[TAB_ACTIVE] ?? data.activeShipmentCount ?? 0
        },
        {
          label: t('loadsHub.opsTabInTransit'),
          value: counts[TAB_TRANSIT] ?? data.inTransitShipmentCount ?? 0
        },
        {
          label: t('loadsHub.opsTabCompleted'),
          value: counts[TAB_COMPLETED] ?? data.completedShipmentCount ?? 0
        }
      ];
    },
    [carrierMode, counts, data, dash, opsReady, searchActive, t]
  );

  return (
    <div className="row g-2 mb-3 tp-ops-summary">
      {items.map((item) => (
        <div key={item.label} className="col-6 col-md-3">
          <div className="rounded-3 border p-2 p-md-3 h-100 tp-border-theme bg-body">
            <div className="small text-muted text-truncate">{item.label}</div>
            <div className="fs-5 fw-semibold text-body">{item.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const DashboardShipmentTabs = ({
  carrierMode = false,
  ops = null,
  opsReady = true,
  activeEmptyState = null,
  transitEmptyState = null,
  historyLimit = 0
}) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState(TAB_ACTIVE);
  const [search, setSearch] = useState('');
  const [tabCounts, setTabCounts] = useState({});
  const [mountedTabs, setMountedTabs] = useState(() => new Set([TAB_ACTIVE]));

  useEffect(() => {
    if (!opsReady) return;
    setMountedTabs(new Set([TAB_REQUEST, TAB_ACTIVE, TAB_TRANSIT, TAB_COMPLETED]));
  }, [opsReady]);

  const reportTabCount = useCallback((tabId, count) => {
    setTabCounts((prev) => {
      if (prev[tabId] === count) return prev;
      return { ...prev, [tabId]: count };
    });
  }, []);

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, [tab]);

  const tabs = useMemo(
    () => [
      { id: TAB_REQUEST, label: t('loadsHub.opsTabRequestSent') },
      { id: TAB_ACTIVE, label: t('loadsHub.opsTabActive') },
      { id: TAB_TRANSIT, label: t('loadsHub.opsTabInTransit') },
      { id: TAB_COMPLETED, label: t('loadsHub.opsTabCompleted') }
    ],
    [t]
  );

  return (
    <div className="tp-dashboard-shipment-tabs tp-operation-center">
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-8">
          <input
            type="search"
            className="form-control form-control-sm rounded-lg"
            placeholder={t('pages.shipments.historySearchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('pages.shipments.historySearchPlaceholder')}
          />
        </div>
      </div>

      <OperationCenterSummary
        carrierMode={carrierMode}
        ops={ops}
        search={search}
        opsReady={opsReady}
        tabCounts={tabCounts}
      />

      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <SegmentTabs tabs={tabs} active={tab} onChange={setTab} />
        {tab === TAB_COMPLETED ? (
          <Link to="/shipments/history" className="small text-decoration-none">
            {t('common.viewAll')}
          </Link>
        ) : null}
      </div>

      {mountedTabs.has(TAB_REQUEST) ? (
        <div className={tab === TAB_REQUEST ? '' : 'd-none'} aria-hidden={tab !== TAB_REQUEST}>
          <ErrorBoundary compact>
            {carrierMode ? (
              <SpaceRequestsPanel embedded onRowCount={(n) => reportTabCount(TAB_REQUEST, n)} />
            ) : (
              <SpaceSentRequestsPanel embedded onRowCount={(n) => reportTabCount(TAB_REQUEST, n)} />
            )}
          </ErrorBoundary>
        </div>
      ) : null}

      {mountedTabs.has(TAB_ACTIVE) ? (
        <div className={tab === TAB_ACTIVE ? '' : 'd-none'} aria-hidden={tab !== TAB_ACTIVE}>
          <ErrorBoundary compact>
            <ActiveShipmentsList
              carrierMode={carrierMode}
              statusFilter="active"
              searchQuery={search}
              emptyState={activeEmptyState}
              onRowCount={(n) => reportTabCount(TAB_ACTIVE, n)}
            />
          </ErrorBoundary>
        </div>
      ) : null}

      {mountedTabs.has(TAB_TRANSIT) ? (
        <div className={tab === TAB_TRANSIT ? '' : 'd-none'} aria-hidden={tab !== TAB_TRANSIT}>
        <ErrorBoundary compact>
            <ActiveShipmentsList
              carrierMode={carrierMode}
              statusFilter="in_transit"
              searchQuery={search}
              skipBootstrap
              emptyState={
                transitEmptyState ?? (
                  <div className="text-muted text-center py-4 small">{t('pages.dashboard.emptyNoInTransit')}</div>
                )
              }
              onRowCount={(n) => reportTabCount(TAB_TRANSIT, n)}
            />
        </ErrorBoundary>
        </div>
      ) : null}

      {mountedTabs.has(TAB_COMPLETED) ? (
        <div className={tab === TAB_COMPLETED ? '' : 'd-none'} aria-hidden={tab !== TAB_COMPLETED}>
        <ErrorBoundary compact>
            <ShipmentHistoryPanel
              carrierMode={carrierMode}
              limit={historyLimit}
              statusScope="completed"
              searchQuery={search}
              onRowCount={(n) => reportTabCount(TAB_COMPLETED, n)}
            />
        </ErrorBoundary>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardShipmentTabs;
