import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatLoadDisplayId } from '../utils/displayId.js';

const MAX_ACTIVITY = 50;
const MAX_AUDIT = 50;

function dedupeById(items, idKey = 'id') {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(item?.[idKey] ?? '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function activityKey(item) {
  return `${item.type}-${item.id}-${item.ts}`;
}

/**
 * Admin live feed — incremental audit merge + activity timeline from widget data.
 */
export function useAdminLiveFeed({ live, widgetFailed, t, locale }) {
  const [extraAuditEvents, setExtraAuditEvents] = useState([]);
  const [recentLiveIds, setRecentLiveIds] = useState(() => new Set());

  const prependAuditEvents = useCallback((events) => {
    const rows = Array.isArray(events) ? events.filter((e) => e?.id) : [];
    if (!rows.length) return;
    setExtraAuditEvents((prev) => dedupeById([...rows, ...prev]).slice(0, MAX_AUDIT));
  }, []);

  useEffect(() => {
    const onAudit = (e) => {
      const events = e?.detail?.events;
      if (Array.isArray(events) && events.length) {
        prependAuditEvents(events);
      }
    };
    window.addEventListener('tp:admin-audit-sync', onAudit);
    return () => window.removeEventListener('tp:admin-audit-sync', onAudit);
  }, [prependAuditEvents]);

  const auditEvents = useMemo(() => {
    return dedupeById([...extraAuditEvents, ...(live?.auditEvents || [])]).slice(0, MAX_AUDIT);
  }, [extraAuditEvents, live?.auditEvents]);

  const activity = useMemo(() => {
    const items = [];
    const loadsOk = !widgetFailed('loads');
    const bidsOk = !widgetFailed('bids');
    const shipmentsOk = !widgetFailed('shipments');

    if (loadsOk) {
      (live?.recentLoads || []).forEach((r) => {
        items.push({
          id: `load-${r.id}`,
          type: 'load',
          variant: 'info',
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
          type: 'bid',
          variant: 'warning',
          ts: r.createdAt,
          label: t('pages.admin.activityBid'),
          detail: `${formatLoadDisplayId({ code: r.loadCode })} · PKR ${r.amount}`,
          meta: r.carrierName
        });
      });
    }
    if (shipmentsOk) {
      (live?.recentShipments || []).forEach((r) => {
        const status = String(r.status || '').toLowerCase();
        const variant =
          status === 'delivered' || status === 'closed'
            ? 'success'
            : status === 'cancelled'
              ? 'critical'
              : 'info';
        items.push({
          id: `shp-${r.id}`,
          type: 'shipment',
          variant,
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
      .slice(0, MAX_ACTIVITY);
  }, [live, t, widgetFailed]);

  useEffect(() => {
    const next = new Set();
    activity.slice(0, 8).forEach((item) => next.add(activityKey(item)));
    setRecentLiveIds(next);
  }, [activity]);

  const markLivePulse = useCallback(
    (item) => recentLiveIds.has(activityKey(item)),
    [recentLiveIds]
  );

  return {
    activity,
    auditEvents,
    prependAuditEvents,
    markLivePulse
  };
}

export function groupActivityByTime(items, locale) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const groups = { today: [], yesterday: [], earlier: [] };
  for (const item of items) {
    const d = new Date(item.ts);
    if (Number.isNaN(d.getTime())) continue;
    if (d >= startOfToday) groups.today.push(item);
    else if (d >= startOfYesterday) groups.yesterday.push(item);
    else groups.earlier.push(item);
  }
  return groups;
}

export function formatWhen(iso, locale) {
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
