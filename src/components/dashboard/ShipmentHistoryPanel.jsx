import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SegmentTabs from '../ui/SegmentTabs.jsx';
import Loader from '../ui/Loader.jsx';
import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { normalizeShipmentStatus } from '../../utils/shipmentStatus.js';
import { sanitizeBadgeVariant } from '../../utils/badgeVariants.js';
import { normalizeBidStatus, BID_STATUS } from '../../utils/bidStatus.js';
import { normalizeShipmentHistoryList } from '../../utils/normalizeShipmentHistory.js';

const TAB_COMPLETED = 'completed';
const TAB_CLOSED = 'closed';
const TAB_CANCELLED = 'cancelled';

function historyBadgeVariant(status) {
  const s = normalizeShipmentStatus(status);
  if (s === 'delivered') return 'success';
  if (s === 'closed') return 'secondary';
  if (s === 'cancelled') return 'danger';
  return 'secondary';
}

async function fetchCompletedRows(request) {
  try {
    const history = await request({ url: '/shipments/history', skipGlobalErrorToast: true });
    if (Array.isArray(history) && history.length > 0) return history;
  } catch {
    /* optional endpoint — fall through */
  }
  try {
    const data = await request({ url: '/shipments/completed', skipGlobalErrorToast: true });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchCancelledRows(request, carrierMode) {
  try {
    if (carrierMode) {
      const bids = await request({ url: '/bids/mine', skipGlobalErrorToast: true });
      return (Array.isArray(bids) ? bids : [])
        .filter((b) => normalizeBidStatus(b.status) === BID_STATUS.REJECTED)
        .map((b) => ({
          id: b.id,
          code: b.loadCode || b.loadId,
          cargo: b.loadCode || b.loadId || '—',
          origin: '',
          destination: '',
          shipmentStatus: 'cancelled',
          status: 'cancelled'
        }));
    }
    const mine = await request({ url: '/loads/mine', skipGlobalErrorToast: true });
    return (Array.isArray(mine) ? mine : []).filter(
      (l) => String(l.status || '').toLowerCase() === 'cancelled'
    );
  } catch {
    return [];
  }
}

/**
 * Compact shipment history for dashboards (does not affect active shipments).
 */
const ShipmentHistoryPanel = ({ carrierMode = false, limit = 5 }) => {
  const { t } = useLanguage();
  const { request } = useApi();
  const [tab, setTab] = useState(TAB_COMPLETED);
  const [search, setSearch] = useState('');
  const [completedRows, setCompletedRows] = useState([]);
  const [cancelledRows, setCancelledRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [completed, cancelled] = await Promise.all([
        fetchCompletedRows(request),
        fetchCancelledRows(request, carrierMode)
      ]);
      setCompletedRows(normalizeShipmentHistoryList(completed, { carrierMode }));
      setCancelledRows(
        normalizeShipmentHistoryList(
          cancelled.map((r) => ({
            ...r,
            cargo: r.cargo || r.code || t('pages.shipments.historyBidRow')
          })),
          { carrierMode }
        )
      );
    } catch {
      setCompletedRows([]);
      setCancelledRows([]);
    } finally {
      setLoading(false);
    }
  }, [request, carrierMode, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'shipments' && scope !== 'loads' && scope !== 'bids') {
        return;
      }
      refresh();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [refresh]);

  const tabs = useMemo(
    () => [
      { id: TAB_COMPLETED, label: t('pages.shipments.historyTabCompleted') },
      { id: TAB_CLOSED, label: t('pages.shipments.historyTabClosed') },
      { id: TAB_CANCELLED, label: t('pages.shipments.historyTabCancelled') }
    ],
    [t]
  );

  const filtered = useMemo(() => {
    let rows = [];
    if (tab === TAB_CANCELLED) rows = cancelledRows;
    else {
      const want = tab === TAB_CLOSED ? 'closed' : 'delivered';
      rows = completedRows.filter((r) => {
        const s = normalizeShipmentStatus(r.shipmentStatus ?? r.status);
        return s === want;
      });
    }
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const code = String(r.shipmentRef || r.code || r.id || '').toLowerCase();
      const cargo = String(r.cargo || '').toLowerCase();
      const route = `${r.origin || ''} ${r.destination || ''}`.toLowerCase();
      return code.includes(q) || cargo.includes(q) || route.includes(q);
    });
  }, [tab, completedRows, cancelledRows, search]);

  const visible = limit > 0 ? filtered.slice(0, limit) : filtered;

  if (loading) {
    return (
      <div className="text-center py-3">
        <Loader />
      </div>
    );
  }

  const roleHint = carrierMode
    ? t('pages.shipments.historyRoleCarrier')
    : t('pages.shipments.historyRoleShipper');

  return (
    <div className="tp-shipment-history-panel">
      <p className="small text-muted mb-2">{roleHint}</p>
      <input
        type="search"
        className="form-control form-control-sm mb-2"
        placeholder={t('pages.shipments.historySearchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={t('pages.shipments.historySearchPlaceholder')}
      />
      <SegmentTabs tabs={tabs} active={tab} onChange={setTab} className="mb-3" />
      {visible.length === 0 ? (
        <p className="small text-muted mb-0">{t('pages.shipments.historyEmptyTitle')}</p>
      ) : (
        visible.map((row) => {
          const code = row.shipmentRef || row.code || row.id;
          const status = row.unifiedStatus ?? row.shipmentStatus ?? row.status;
          const statusKey = normalizeShipmentStatus(status) || 'unknown';
          return (
            <Card key={`${tab}-${row.id || code}`} className="p-2 mb-2">
              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="fw-semibold small text-truncate">{row.cargo || code}</div>
                  <div className="text-muted small">
                    {code}
                    {row.counterpartyName ? ` · ${row.counterpartyName}` : ''}
                    {row.origin && row.destination ? ` · ${row.origin} → ${row.destination}` : ''}
                  </div>
                </div>
                <Badge variant={sanitizeBadgeVariant(historyBadgeVariant(status))}>
                  {t(`status.${statusKey}`) !== `status.${statusKey}`
                    ? t(`status.${statusKey}`)
                    : String(status || '—')}
                </Badge>
              </div>
              {code ? (
                <div className="text-end mt-1">
                  <Link
                    to={`/shipments/tracking/${encodeURIComponent(code)}`}
                    className="btn btn-link btn-sm p-0"
                  >
                    {t('pages.shipments.historyView')}
                  </Link>
                </div>
              ) : null}
            </Card>
          );
        })
      )}
    </div>
  );
};

export default ShipmentHistoryPanel;
