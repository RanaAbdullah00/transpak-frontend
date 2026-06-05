import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaHistory } from 'react-icons/fa';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { SkeletonCard } from '../../components/ui/Skeleton.jsx';
import Badge from '../../components/ui/Badge.jsx';
import SegmentTabs from '../../components/ui/SegmentTabs.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError } from '../../components/ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import VehicleTypeLabel from '../../components/loadboard/VehicleTypeLabel.jsx';
import { normalizeBidStatus, BID_STATUS } from '../../utils/bidStatus.js';
import { normalizeShipmentStatus } from '../../utils/shipmentStatus.js';
import { normalizeShipmentHistoryList } from '../../utils/normalizeShipmentHistory.js';
import { sanitizeBadgeVariant } from '../../utils/badgeVariants.js';
import { translateBidStatus } from '../../utils/i18nLabels.js';

const TAB_COMPLETED = 'completed';
const TAB_ACCEPTED = 'accepted';
const TAB_REJECTED = 'rejected';
const TAB_CANCELLED = 'cancelled';

const COMPLETED_STATUSES = new Set(['closed', 'delivered']);

async function fetchCompletedShipments(request, roles) {
  try {
    const data = await request({ url: '/shipments/completed', skipGlobalErrorToast: true });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    const status = err?.response?.status;
    const notFound =
      status === 404 || String(err?.response?.data?.code || '').toUpperCase() === 'NOT_FOUND';
    if (!notFound) throw err;
    if (roles.includes('shipper')) {
      const mine = await request({ url: '/loads/mine', skipGlobalErrorToast: true });
      return (Array.isArray(mine) ? mine : []).filter((l) =>
        COMPLETED_STATUSES.has(String(l.status || '').toLowerCase())
      );
    }
    return [];
  }
}

function historyBadgeVariant(status, tab) {
  const s = normalizeShipmentStatus(status);
  if (tab === TAB_REJECTED || tab === TAB_CANCELLED) return 'danger';
  if (s === 'delivered') return 'success';
  if (s === 'closed') return 'secondary';
  if (tab === TAB_ACCEPTED) return 'primary';
  return 'secondary';
}

const ShipmentHistory = () => {
  const { request, loading } = useApi();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useState(TAB_COMPLETED);
  const [completedRows, setCompletedRows] = useState([]);
  const [acceptedRows, setAcceptedRows] = useState([]);
  const [rejectedRows, setRejectedRows] = useState([]);
  const [cancelledRows, setCancelledRows] = useState([]);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const activeRole = user?.activeRole ?? roles[0];
  const carrierMode = activeRole === 'carrier';

  const refreshHistory = useCallback(async () => {
    try {
      const [completed, bidsRaw, spaceSent] = await Promise.all([
        fetchCompletedShipments(request, roles),
        request({
          url: carrierMode ? '/bids/mine' : '/bids',
          skipGlobalErrorToast: true
        }).catch(() => []),
        !carrierMode
          ? request({ url: '/carrier-space/requests/sent', skipGlobalErrorToast: true }).catch(() => [])
          : Promise.resolve([])
      ]);

      const bids = Array.isArray(bidsRaw) ? bidsRaw : [];
      const acceptedBids = bids
        .filter((b) => normalizeBidStatus(b.status) === BID_STATUS.ACCEPTED)
        .map((b) => ({
          id: b.id,
          code: b.loadCode || b.loadId,
          cargo: b.loadCode || b.loadId || t('pages.shipments.historyBidRow'),
          origin: '',
          destination: '',
          shipmentStatus: 'booked',
          status: 'booked',
          counterpartyName: carrierMode ? null : b.carrierName
        }));

      const rejectedBids = bids
        .filter((b) => normalizeBidStatus(b.status) === BID_STATUS.REJECTED)
        .map((b) => ({
          id: b.id,
          code: b.loadCode || b.loadId,
          cargo: b.loadCode || b.loadId || t('pages.shipments.historyBidRow'),
          origin: '',
          destination: '',
          shipmentStatus: 'rejected',
          status: 'rejected',
          bidStatus: b.status,
          counterpartyName: carrierMode ? null : b.carrierName
        }));

      const rejectedSpace = (Array.isArray(spaceSent) ? spaceSent : [])
        .filter((r) => String(r.status || '').toLowerCase() === 'rejected')
        .map((r) => ({
          id: r.id,
          code: r.loadCode || r.id,
          cargo: `${r.origin || ''} → ${r.destination || ''}`.trim() || r.id,
          origin: r.origin,
          destination: r.destination,
          shipmentStatus: 'rejected',
          status: 'rejected'
        }));

      let cancelled = [];
      if (carrierMode) {
        cancelled = bids
          .filter((b) => normalizeBidStatus(b.status) === BID_STATUS.CANCELLED)
          .map((b) => ({
            id: b.id,
            code: b.loadCode || b.loadId,
            cargo: b.loadCode || b.loadId,
            shipmentStatus: 'cancelled',
            status: 'cancelled'
          }));
      } else {
        const mine = await request({ url: '/loads/mine', skipGlobalErrorToast: true }).catch(() => []);
        cancelled = (Array.isArray(mine) ? mine : []).filter(
          (l) => String(l.status || '').toLowerCase() === 'cancelled'
        );
      }

      setCompletedRows(normalizeShipmentHistoryList(completed, { carrierMode }));
      setAcceptedRows(normalizeShipmentHistoryList(acceptedBids, { carrierMode }));
      setRejectedRows(
        normalizeShipmentHistoryList([...rejectedBids, ...rejectedSpace], { carrierMode })
      );
      setCancelledRows(normalizeShipmentHistoryList(cancelled, { carrierMode }));
    } catch (err) {
      setCompletedRows([]);
      setAcceptedRows([]);
      setRejectedRows([]);
      setCancelledRows([]);
      notifyError(formatUserError(err, t, { fallback: t('pages.shipments.historyLoadFailed') }));
    }
  }, [request, roles, carrierMode, t]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'shipments' && scope !== 'bids' && scope !== 'loads' && scope !== 'space') {
        return;
      }
      refreshHistory();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [refreshHistory]);

  const tabs = useMemo(
    () => [
      { id: TAB_COMPLETED, label: t('pages.shipments.historyTabCompleted') },
      { id: TAB_ACCEPTED, label: t('pages.shipments.historyTabAccepted') },
      { id: TAB_REJECTED, label: t('pages.shipments.historyTabRejected') },
      { id: TAB_CANCELLED, label: t('pages.shipments.historyTabCancelled') }
    ],
    [t]
  );

  const rows = useMemo(() => {
    if (tab === TAB_ACCEPTED) return acceptedRows;
    if (tab === TAB_REJECTED) return rejectedRows;
    if (tab === TAB_CANCELLED) return cancelledRows;
    return completedRows;
  }, [tab, completedRows, acceptedRows, rejectedRows, cancelledRows]);

  const roleHint = carrierMode
    ? t('pages.shipments.historyRoleCarrier')
    : t('pages.shipments.historyRoleShipper');

  return (
    <div className="container py-3">
      <h5 className="mb-1">{t('pages.shipments.historyTitle')}</h5>
      <p className="small text-muted mb-2">{roleHint}</p>
      <p className="small text-muted mb-3">{t('pages.shipments.historyLead')}</p>
      <SegmentTabs tabs={tabs} active={tab} onChange={setTab} className="mb-3" />
      {loading ? (
        <>
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FaHistory}
          title={t('pages.shipments.historyEmptyTitle')}
          body={t('empty.shipmentsBody')}
        />
      ) : (
        rows.map((row) => {
          const code = row.shipmentRef || row.code || row.id;
          const status = row.unifiedStatus ?? row.shipmentStatus ?? row.status;
          const bidStatus = row._raw?.bidStatus;
          const label =
            tab === TAB_REJECTED && bidStatus
              ? translateBidStatus(t, bidStatus)
              : t(`status.${normalizeShipmentStatus(status) || 'unknown'}`) !==
                  `status.${normalizeShipmentStatus(status) || 'unknown'}`
                ? t(`status.${normalizeShipmentStatus(status) || 'unknown'}`)
                : t('pages.shipments.historyClosedLabel');
          return (
            <Card key={`${tab}-${row.id || code}`} className="p-3 mb-2">
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                  <div className="fw-semibold">{row.cargo || code}</div>
                  <div className="small text-muted">
                    {code}
                    {row.counterpartyName ? ` · ${row.counterpartyName}` : ''}
                    {row.origin && row.destination ? ` · ${row.origin} → ${row.destination}` : ''}
                  </div>
                  {row._raw?.vehicleType ? (
                    <div className="small text-muted mt-1">
                      <VehicleTypeLabel value={row._raw.vehicleType} />
                    </div>
                  ) : null}
                </div>
                <Badge variant={sanitizeBadgeVariant(historyBadgeVariant(status, tab))}>{label}</Badge>
              </div>
              {code && tab !== TAB_REJECTED ? (
                <div className="d-flex justify-content-end mt-2">
                  <Link
                    to={`/shipments/tracking/${encodeURIComponent(code)}`}
                    className="btn btn-outline-primary btn-sm rounded-lg"
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

export default ShipmentHistory;
