import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SegmentTabs from '../ui/SegmentTabs.jsx';
import Loader from '../ui/Loader.jsx';
import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { normalizeShipmentStatus } from '../../utils/shipmentStatus.js';
import { sanitizeBadgeVariant } from '../../utils/badgeVariants.js';
import { resolveBadgeVariantForStatus } from '../../utils/statusColorTokens.js';
import { normalizeBidStatus, BID_STATUS, isBidExpired } from '../../utils/bidStatus.js';
import { normalizeShipmentHistoryList } from '../../utils/normalizeShipmentHistory.js';
import { fetchCompletedShipmentRows, loadHistoryCache, saveHistoryCache } from '../../utils/shipmentHistoryFetch.js';
import EmptyState from '../ui/EmptyState.jsx';
import Button from '../ui/Button.jsx';
import ProfileAccessLayer from '../profile/ProfileAccessLayer.jsx';

const TAB_COMPLETED = 'completed';
const TAB_ACCEPTED = 'accepted';
const TAB_CANCELLED = 'cancelled';

function historyBadgeVariant(status) {
  return resolveBadgeVariantForStatus(status);
}

async function fetchCompletedRows(request, roles) {
  return fetchCompletedShipmentRows(request, { roles });
}

async function fetchAcceptedRows(request, carrierMode) {
  try {
    const bids = await request({
      url: carrierMode ? '/bids/mine' : '/bids',
      skipGlobalErrorToast: true
    });
    return (Array.isArray(bids) ? bids : [])
      .filter((b) => normalizeBidStatus(b.status) === BID_STATUS.ACCEPTED && !isBidExpired(b))
      .map((b) => ({
        id: b.id,
        code: b.loadCode || b.loadId,
        cargo: b.loadCode || b.loadId || '—',
        origin: b.origin || '',
        destination: b.destination || '',
        shipmentStatus: 'booked',
        status: 'booked',
        shipperId: b.shipperId,
        shipperName: b.shipperName,
        counterpartyId: carrierMode ? b.shipperId : b.carrierId,
        counterpartyName: carrierMode ? b.shipperName : b.carrierName
      }));
  } catch {
    return [];
  }
}

async function fetchCancelledRows(request, carrierMode) {
  try {
    if (carrierMode) {
      const bids = await request({ url: '/bids/mine', skipGlobalErrorToast: true });
      return (Array.isArray(bids) ? bids : [])
        .filter((b) => normalizeBidStatus(b.status) === BID_STATUS.CANCELLED)
        .map((b) => ({
          id: b.id,
          code: b.loadCode || b.loadId,
          cargo: b.loadCode || b.loadId || '—',
          origin: '',
          destination: '',
          shipmentStatus: 'cancelled',
          status: 'cancelled',
          shipperId: b.shipperId,
          shipperName: b.shipperName
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

const ShipmentHistoryPanel = ({
  carrierMode = false,
  limit = 5,
  statusScope = null,
  searchQuery = '',
  onRowCount
}) => {
  const { t } = useLanguage();
  const { request } = useApi();
  const { user } = useAuth();
  const [tab, setTab] = useState(TAB_COMPLETED);
  const [internalSearch, setInternalSearch] = useState('');
  const [completedRows, setCompletedRows] = useState([]);
  const [acceptedRows, setAcceptedRows] = useState([]);
  const [cancelledRows, setCancelledRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const search = searchQuery || internalSearch;

  const refresh = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [completedResult, accepted, cancelled] = await Promise.all([
        fetchCompletedRows(request, carrierMode ? ['carrier'] : ['shipper']),
        fetchAcceptedRows(request, carrierMode),
        fetchCancelledRows(request, carrierMode)
      ]);
      if (completedResult.error) {
        setFetchError(completedResult.error);
        const cached = loadHistoryCache(user?.id);
        if (Array.isArray(cached) && cached.length) {
          setCompletedRows(normalizeShipmentHistoryList(cached, { carrierMode }));
        }
      } else {
        saveHistoryCache(user?.id, completedResult.rows);
        setCompletedRows(normalizeShipmentHistoryList(completedResult.rows, { carrierMode }));
      }
      setAcceptedRows(normalizeShipmentHistoryList(accepted, { carrierMode }));
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
      const cached = loadHistoryCache(user?.id);
      setCompletedRows(
        Array.isArray(cached) && cached.length
          ? normalizeShipmentHistoryList(cached, { carrierMode })
          : []
      );
      setAcceptedRows([]);
      setCancelledRows([]);
      setFetchError({ retryable: true, message: 'history_failed' });
    } finally {
      setLoading(false);
    }
  }, [request, carrierMode, t, user?.id]);

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
      { id: TAB_ACCEPTED, label: t('pages.shipments.historyTabAccepted') },
      { id: TAB_COMPLETED, label: t('pages.shipments.historyTabCompleted') },
      { id: TAB_CANCELLED, label: t('pages.shipments.historyTabCancelled') }
    ],
    [t]
  );

  const filtered = useMemo(() => {
    let rows = [];
    if (tab === TAB_ACCEPTED) rows = acceptedRows;
    else if (tab === TAB_CANCELLED) rows = cancelledRows;
    else {
      rows = completedRows.filter((r) => {
        const s = normalizeShipmentStatus(r.shipmentStatus ?? r.status);
        return s === 'delivered' || s === 'closed';
      });
    }
    if (statusScope === 'completed') {
      rows = completedRows.filter((r) => {
        const s = normalizeShipmentStatus(r.shipmentStatus ?? r.status);
        return s === 'delivered' || s === 'closed';
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
  }, [tab, completedRows, acceptedRows, cancelledRows, search, statusScope]);

  const visible = limit > 0 ? filtered.slice(0, limit) : filtered;

  useEffect(() => {
    if (loading) return;
    if (statusScope === 'completed') onRowCount?.(filtered.length);
  }, [filtered.length, loading, onRowCount, statusScope]);

  if (loading) {
    return (
      <div className="text-center py-3">
        <Loader />
      </div>
    );
  }

  return (
    <div className="tp-shipment-history-panel">
      {!searchQuery ? (
        <input
          type="search"
          className="form-control form-control-sm mb-2"
          placeholder={t('pages.shipments.historySearchPlaceholder')}
          value={internalSearch}
          onChange={(e) => setInternalSearch(e.target.value)}
          aria-label={t('pages.shipments.historySearchPlaceholder')}
        />
      ) : null}
      {!statusScope ? <SegmentTabs tabs={tabs} active={tab} onChange={setTab} className="mb-3" /> : null}
      {fetchError ? (
        <Card className="p-3 mb-2 text-center">
          <p className="small text-danger mb-2">{t('pages.shipments.historyLoadFailed')}</p>
          <Button variant="outline-primary" size="sm" onClick={refresh}>
            {t('pages.admin.tryAgain')}
          </Button>
        </Card>
      ) : null}
      {visible.length === 0 ? (
        <EmptyState title={t('pages.shipments.historyEmptyTitle')} body={t('empty.shipmentsBody')} />
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
                  <div className="text-muted small d-flex flex-wrap align-items-center gap-1">
                    <span>{code}</span>
                    {row.counterpartyId ? (
                      <ProfileAccessLayer
                        userId={row.counterpartyId}
                        name={row.counterpartyName}
                        avatarSrc={row.counterpartyAvatar}
                        className="small"
                      />
                    ) : row.counterpartyName ? (
                      <span>· {row.counterpartyName}</span>
                    ) : null}
                    {row.origin && row.destination ? (
                      <span>
                        · {row.origin} → {row.destination}
                      </span>
                    ) : null}
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
