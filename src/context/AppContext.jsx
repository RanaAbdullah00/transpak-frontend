import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSocketClient } from '../services/socket.js';
import { normalizeNotification } from '../adapters/normalize.js';
import { isRenderableClientNotification, sanitizeNotificationRoleType } from '../utils/notificationsFilter.js';
import { notificationsForWorkspace, userHasDualCommercialRoles } from '../utils/notificationScope.js';
import { routeRealtimeNotification } from '../utils/notifySystem.js';
import api from '../services/api.js';
import { unwrapResponseData, ensureArray } from '../utils/unwrapApi.js';
import { notifyApiError } from '../utils/notifySystem.js';
import { useAuth } from '../hooks/useAuth.js';
import { getAuthToken } from '../utils/authTokenStorage.js';
import { notificationQueryParams } from '../utils/workspaceApi.js';
import { getWorkspace } from '../utils/workspace.js';
import {
  acknowledgeSyncedEventIds,
  clearRealtimeDedupeCache,
  getLastEventSyncAt
} from '../utils/realtimeDedupe.js';
import { syncEventsSince, syncNotificationsSince, fetchUnreadCount } from '../utils/realtimeSync.js';
import { handleDispatchEvent } from '../utils/realtimeDispatch.js';
import { normalizePersistedNotification } from '../utils/notificationEngine.js';
import { publishNotificationEffects } from '../utils/notificationPipeline.js';
import { pushNotification, clearNotificationStore } from '../utils/notificationStore.js';
import {
  buildNotificationEventId,
  claimNotificationEvent,
  clearNotificationEventRegistry,
  registerNotificationEventIds
} from '../utils/notificationEventRegistry.js';
import { emitRealtimeRefresh } from '../utils/realtimeRefresh.js';
import { pruneWorkspaceQueryCaches } from '../utils/workspaceQueryCache.js';
import { emitShipmentStatusUpdated } from '../utils/shipmentStatusOptimistic.js';
import { normalizeTrackingEvent } from '../utils/trackingEventContract.js';
import { trackingEventDedupeCache } from '../utils/eventDedupeCache.js';
import { recordTrackingEventDeduped } from '../hooks/usePerformanceTelemetry.js';

export const AppContext = createContext(null);

function normalizeNotificationsPayload(data) {
  if (Array.isArray(data)) return { items: data, nextCursor: null, hasMore: false };
  if (data && Array.isArray(data.items)) {
    return {
      items: data.items,
      nextCursor: data.nextCursor || null,
      hasMore: Boolean(data.hasMore)
    };
  }
  return { items: [], nextCursor: null, hasMore: false };
}

function mapNotificationRow(r) {
  const title = r.title != null && String(r.title).trim() !== '' ? String(r.title).trim() : null;
  const type = r.type != null && String(r.type).trim() !== '' ? String(r.type).trim() : title;
  return {
    id: r.id || r._id,
    eventId: r.eventId || r.event_id || r.id || r._id,
    senderId: r.senderId ?? null,
    type,
    title,
    message: r.message || title || '',
    roleType: sanitizeNotificationRoleType(r.roleType),
    read: Boolean(r.read || r.isRead),
    createdAt: r.createdAt
  };
}

export const AppProvider = ({ children }) => {
  const { user, sessionVersion } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [notificationsCursor, setNotificationsCursor] = useState(null);
  const [notificationsHasMore, setNotificationsHasMore] = useState(false);
  const [notificationsLoadingMore, setNotificationsLoadingMore] = useState(false);
  const chatMessageHandlers = useRef(new Set());
  const chatSeenHandlers = useRef(new Set());
  const trackingHandlers = useRef(new Set());
  const lastTrackingSig = useRef({ sig: '', t: 0 });
  const lastTrackingTsByRef = useRef(new Map());
  const socketRef = useRef(null);
  const socketClientRef = useRef(null);
  const socketConnectedRef = useRef(false);
  const socketLostRef = useRef(false);
  const [socketStatus, setSocketStatus] = useState('idle');
  const addNotificationRef = useRef(null);
  const welcomeToastShownRef = useRef(false);
  const lastReconnectSyncRef = useRef(0);
  const reconnectSyncInFlightRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  const registerChatMessageHandler = useCallback((fn) => {
    chatMessageHandlers.current.add(fn);
    return () => chatMessageHandlers.current.delete(fn);
  }, []);

  const registerChatSeenHandler = useCallback((fn) => {
    chatSeenHandlers.current.add(fn);
    return () => chatSeenHandlers.current.delete(fn);
  }, []);

  const registerTrackingHandler = useCallback((fn) => {
    trackingHandlers.current.add(fn);
    return () => trackingHandlers.current.delete(fn);
  }, []);

  const addNotification = useCallback((notification, { showToast = false } = {}) => {
    if (!isRenderableClientNotification(notification)) return;
    const base = normalizeNotification(notification) || notification;
    const normalized = {
      ...base,
      roleType: sanitizeNotificationRoleType(base.roleType)
    };
    const eid = normalized.eventId || normalized.id || normalized._id;
    const globalEventId = buildNotificationEventId({
      dispatchType: normalized.type || normalized.title,
      shipmentRef: normalized.shipmentRef || normalized.refKey,
      timestamp: normalized.createdAt,
      eventId: eid
    });
    const isNewEvent = claimNotificationEvent({ globalEventId, eventId: eid });
    const nid = normalized.id ?? normalized._id;
    setNotifications((prev) => {
      if (eid && prev.some((p) => String(p.eventId || p.id || p._id) === String(eid))) {
        return prev;
      }
      if (nid != null && prev.some((p) => String(p.id ?? p._id) === String(nid))) {
        return prev;
      }
      const msg = String(normalized.message || '').slice(0, 200);
      const title = String(normalized.title || normalized.type || '');
      const t0 = new Date(normalized.createdAt || Date.now()).getTime();
      const dup = prev.some((p) => {
        const pm = String(p.message || '').slice(0, 200);
        const pt = String(p.title || p.type || '');
        const t1 = new Date(p.createdAt || 0).getTime();
        return pm === msg && pt === title && Math.abs(t0 - t1) < 120000;
      });
      if (dup) return prev;
      const next = [{ id: nid ?? `local-${Date.now()}`, read: Boolean(normalized.read), ...normalized }, ...prev];
      const scoped = user ? notificationsForWorkspace(next, user) : next;
      const eng = normalizePersistedNotification(normalized);
      eng.globalEventId =
        eng.globalEventId ||
        buildNotificationEventId({
          dispatchType: eng.dispatchType,
          shipmentRef: eng.shipmentRef,
          timestamp: eng.timestamp,
          eventId: eid
        });
      pushNotification({ ...eng, read: Boolean(normalized.read), dedupeKey: eng.globalEventId });
      if (showToast && isNewEvent) {
        queueMicrotask(() => {
          publishNotificationEffects(eng, { burstKey: eng.globalEventId });
          const unread = scoped.filter((n) => !(n.read || n.isRead)).length;
          window.dispatchEvent(new CustomEvent('tp:unread-sync', { detail: { count: unread } }));
        });
      }
      return scoped;
    });
  }, [user?.id, user?.activeRole]);

  addNotificationRef.current = (n) => addNotification(n, { showToast: true });

  const markNotificationRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => {
        const nid = n.id ?? n._id;
        return nid === id || String(nid) === String(id) ? { ...n, read: true, isRead: true } : n;
      })
    );
    api.patch(`/notifications/${id}/read`, {}, { skipGlobalErrorToast: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      welcomeToastShownRef.current = false;
      return undefined;
    }

    setNotifications([]);
    setNotificationsCursor(null);
    setNotificationsHasMore(false);
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/notifications', {
          params: notificationQueryParams(user, { limit: 30 }),
          skipGlobalErrorToast: true
        });
        if (cancelled) return;
        const page = normalizeNotificationsPayload(unwrapResponseData(res));
        const items = ensureArray(page.items).map(mapNotificationRow);
        setNotifications(items);
        setNotificationsCursor(page.nextCursor);
        setNotificationsHasMore(page.hasMore);
        const welcome = items.find(
          (n) => String(n.type || n.title || '').toUpperCase() === 'LOGIN_SUCCESS' && !n.read
        );
        if (welcome && !welcomeToastShownRef.current) {
          const age = Date.now() - new Date(welcome.createdAt || 0).getTime();
          if (age >= 0 && age < 120000) {
            welcomeToastShownRef.current = true;
            queueMicrotask(() => {
              routeRealtimeNotification(welcome);
              window.dispatchEvent(new CustomEvent('tp:notification-sound'));
            });
          }
        }
      } catch (err) {
        if (err?.response?.status !== 401) notifyApiError(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.activeRole]);

  const mergeNotificationsFromServer = useCallback((rows) => {
    const list = ensureArray(rows);
    registerNotificationEventIds(list);
    const mapped = list.map(mapNotificationRow);
    setNotifications((prev) => {
      const byId = new Map();
      const keyOf = (n) => String(n.eventId || n.id || n._id || '');
      prev.forEach((n) => {
        const k = keyOf(n);
        if (k) byId.set(k, n);
      });
      mapped.forEach((n) => {
        const k = keyOf(n);
        if (k) byId.set(k, n);
      });
      const merged = [...byId.values()];
      const scoped = user ? notificationsForWorkspace(merged, user) : merged;
      return scoped.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [user?.id, user?.activeRole]);

  const syncReconnectNotifications = useCallback(async () => {
    if (!user?.id || reconnectSyncInFlightRef.current) return;
    reconnectSyncInFlightRef.current = true;
    try {
      const since = getLastEventSyncAt(user.id);
      const out = await syncEventsSince(user, since ? { since } : {});
      mergeNotificationsFromServer(ensureArray(out.notifications));
      window.dispatchEvent(
        new CustomEvent('tp:unread-sync', { detail: { count: out.unreadCount } })
      );
      const scopes = ensureArray(out.refreshScopes);
      if (scopes.length) {
        const unique = [...new Set(scopes)];
        unique.forEach((scope) => emitRealtimeRefresh(scope));
      } else {
        emitRealtimeRefresh('all');
      }
      if (out.auditEvents?.length) {
        window.dispatchEvent(
          new CustomEvent('tp:admin-audit-sync', { detail: { events: out.auditEvents } })
        );
      }
    } catch (err) {
      if (err?.response?.status === 401) return;
      try {
        const since = getLastEventSyncAt(user.id);
        const fallback = await syncNotificationsSince(user, since ? { since } : {});
        const synced = ensureArray(fallback.items);
        acknowledgeSyncedEventIds(synced);
        mergeNotificationsFromServer(synced);
        window.dispatchEvent(
          new CustomEvent('tp:unread-sync', { detail: { count: fallback.unreadCount } })
        );
        emitRealtimeRefresh('all');
      } catch {
        /* optional — list refetch still runs */
      }
    } finally {
      reconnectSyncInFlightRef.current = false;
    }
  }, [user, mergeNotificationsFromServer]);

  const refetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await api.get('/notifications', {
        params: notificationQueryParams(user, { limit: 30 }),
        skipGlobalErrorToast: true
      });
      const page = normalizeNotificationsPayload(unwrapResponseData(res));
      mergeNotificationsFromServer(ensureArray(page.items));
      setNotificationsCursor(page.nextCursor);
      setNotificationsHasMore(page.hasMore);
      window.dispatchEvent(new CustomEvent('tp_notifications_read'));
      try {
        const count = await fetchUnreadCount(user);
        window.dispatchEvent(new CustomEvent('tp:unread-sync', { detail: { count } }));
      } catch {
        /* ignore */
      }
    } catch (err) {
      if (err?.response?.status !== 401) notifyApiError(err);
    }
  }, [mergeNotificationsFromServer, user]);

  const loadMoreNotifications = useCallback(async () => {
    if (!notificationsHasMore || !notificationsCursor || notificationsLoadingMore) return;
    setNotificationsLoadingMore(true);
    try {
      const res = await api.get('/notifications', {
        params: notificationQueryParams(user, { limit: 30, cursor: notificationsCursor }),
        skipGlobalErrorToast: true
      });
      const page = normalizeNotificationsPayload(unwrapResponseData(res));
      mergeNotificationsFromServer(ensureArray(page.items));
      setNotificationsCursor(page.nextCursor);
      setNotificationsHasMore(page.hasMore);
    } catch (err) {
      if (err?.response?.status !== 401) notifyApiError(err);
    } finally {
      setNotificationsLoadingMore(false);
    }
  }, [notificationsCursor, notificationsHasMore, notificationsLoadingMore, mergeNotificationsFromServer, user]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      const notifyScopes = new Set(['all', 'loads', 'bids', 'shipments', 'space']);
      if (scope && !notifyScopes.has(scope)) return;
      refetchNotifications();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [refetchNotifications]);

  useEffect(() => {
    const onSessionCleared = () => {
      setNotifications([]);
      setNotificationsCursor(null);
      setNotificationsHasMore(false);
      lastTrackingSig.current = { sig: '', t: 0 };
      lastTrackingTsByRef.current.clear();
      clearRealtimeDedupeCache();
      clearNotificationStore();
      clearNotificationEventRegistry();
    };
    window.addEventListener('tp:session-cleared', onSessionCleared);
    return () => window.removeEventListener('tp:session-cleared', onSessionCleared);
  }, []);

  useEffect(() => {
    const onRoleSwitch = () => {
      setNotifications([]);
      setNotificationsCursor(null);
      setNotificationsHasMore(false);
      lastTrackingSig.current = { sig: '', t: 0 };
      lastTrackingTsByRef.current.clear();
      clearRealtimeDedupeCache();
      refetchNotifications();
    };
    window.addEventListener('tp:role-switched', onRoleSwitch);
    return () => window.removeEventListener('tp:role-switched', onRoleSwitch);
  }, [refetchNotifications]);

  useEffect(() => {
    if (!user?.id || socketStatus === 'connected') return undefined;

    const reconcileMs = Number(import.meta.env.VITE_CACHE_RECONCILE_MS || 300000);
    const reconcileId = window.setInterval(async () => {
      if (document.hidden || socketConnectedRef.current) return;
      pruneWorkspaceQueryCaches();
      try {
        const count = await fetchUnreadCount(user);
        window.dispatchEvent(new CustomEvent('tp:unread-sync', { detail: { count } }));
      } catch {
        /* offline */
      }
    }, reconcileMs);

    return () => window.clearInterval(reconcileId);
  }, [user?.id, user?.activeRole, socketStatus]);

  useEffect(() => {
    if (!user?.id || socketStatus === 'connected') return undefined;

    const pollMs = Number(import.meta.env.VITE_NOTIFICATION_POLL_MS || 12000);
    const pollId = window.setInterval(async () => {
      if (document.hidden || socketConnectedRef.current) return;
      await refetchNotifications();
      try {
        const count = await fetchUnreadCount(user);
        window.dispatchEvent(new CustomEvent('tp:unread-sync', { detail: { count } }));
      } catch {
        /* offline */
      }
    }, pollMs);

    return () => window.clearInterval(pollId);
  }, [user?.id, user?.activeRole, refetchNotifications]);

  const refetchNotificationsRef = useRef(refetchNotifications);
  const syncReconnectRef = useRef(syncReconnectNotifications);
  refetchNotificationsRef.current = refetchNotifications;
  syncReconnectRef.current = syncReconnectNotifications;

  useEffect(() => {
    if (!user?.id) {
      setSocketStatus('idle');
      return undefined;
    }

    const token = getAuthToken();
    const workspaceScoped = (row) => {
      const u = userRef.current;
      if (!u) return true;
      const rt = row?.roleType != null ? String(row.roleType).toLowerCase() : '';
      if (!rt) return true;
      if (userHasDualCommercialRoles(u)) {
        return rt === 'shipper' || rt === 'carrier' || rt === 'admin';
      }
      const active = getWorkspace(u);
      if (active === 'admin') return rt === 'admin';
      return rt === active;
    };

    const ingestNotification = (n) => {
      if (!workspaceScoped(n)) return;
      addNotificationRef.current?.(n);
    };

    const client = createSocketClient({
      token: token || undefined,
      workspace: userRef.current ? getWorkspace(userRef.current) : null,
      onConnectionChange: (connected, meta) => {
        socketConnectedRef.current = Boolean(connected);
        if (connected) {
          socketLostRef.current = false;
          setSocketStatus('connected');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tp:socket-ready', { detail: { status: 'ready' } }));
          }
          return;
        }
        if (meta?.exhausted) {
          socketLostRef.current = true;
          setSocketStatus('lost');
          return;
        }
        socketLostRef.current = false;
        setSocketStatus('reconnecting');
      },
      onReconnect: async () => {
        if (socketLostRef.current) return;
        const now = Date.now();
        if (now - lastReconnectSyncRef.current < 8000) return;
        lastReconnectSyncRef.current = now;
        await syncReconnectRef.current?.();
      },
      onDispatch: (d) => {
        const u = userRef.current;
        if (d?.scope?.workspace && u && !userHasDualCommercialRoles(u)) {
          const active = getWorkspace(u);
          if (String(d.scope.workspace).toLowerCase() !== active) return;
        }
        handleDispatchEvent(d, { onNotification: ingestNotification });
      },
      onNotification: (n) => {
        if (n?.items && Array.isArray(n.items)) {
          n.items.filter(workspaceScoped).forEach((item) => ingestNotification(item));
          return;
        }
        ingestNotification(n);
      },
      onTracking: (p) => {
        const event = normalizeTrackingEvent(p, 'socket');
        if (event.eventId && trackingEventDedupeCache.has(event.eventId)) {
          recordTrackingEventDeduped();
          return;
        }
        const refs = [p?.refKey, p?.loadId]
          .map((v) => String(v ?? '').trim())
          .filter(Boolean);
        const ts = Number(p?.ts);
        if (refs.length && Number.isFinite(ts)) {
          const lastTs = Math.max(...refs.map((r) => lastTrackingTsByRef.current.get(r) || 0));
          if (ts < lastTs) return;
          refs.forEach((r) => lastTrackingTsByRef.current.set(r, ts));
        }
        const sig = `${refs.join('|')}|${p?.tracking?.status}|${ts}|${JSON.stringify(p?.tracking?.currentLocation ?? p?.tracking?.location)}|${(p?.history || []).length}`;
        const now = Date.now();
        if (sig && lastTrackingSig.current.sig === sig && now - lastTrackingSig.current.t < 450) {
          return;
        }
        lastTrackingSig.current = { sig, t: now };
        const status = p?.tracking?.status;
        const statusRef = String(p?.refKey || p?.loadId || '').trim();
        if (statusRef && status) {
          emitShipmentStatusUpdated(statusRef, status, { source: 'socket' });
        }
        trackingHandlers.current.forEach((fn) => {
          try {
            fn(p);
          } catch {
            // ignore
          }
        });
      },
      onChatMessage: (msg) => {
        chatMessageHandlers.current.forEach((fn) => {
          try {
            fn(msg);
          } catch {
            // ignore
          }
        });
      },
      onChatSeen: (payload) => {
        chatSeenHandlers.current.forEach((fn) => {
          try {
            fn(payload);
          } catch {
            // ignore
          }
        });
      }
    });
    socketRef.current = client.socket;
    socketClientRef.current = client;
    return () => {
      client.disconnect();
      socketRef.current = null;
      socketClientRef.current = null;
      setSocketStatus('idle');
    };
  }, [user?.id, sessionVersion]);

  useEffect(() => {
    const ws = user?.activeRole ? getWorkspace(user) : null;
    if (!ws || !socketClientRef.current) return;
    socketClientRef.current.rejoinWorkspace?.(ws);
  }, [user?.activeRole, user?.id]);

  const getSocket = useCallback(() => socketRef.current, []);

  const value = useMemo(
    () => ({
      notifications,
      notificationsHasMore,
      notificationsLoadingMore,
      addNotification,
      markNotificationRead,
      registerChatMessageHandler,
      registerChatSeenHandler,
      registerTrackingHandler,
      refetchNotifications,
      loadMoreNotifications,
      getSocket,
      socketStatus
    }),
    [
      notifications,
      notificationsHasMore,
      notificationsLoadingMore,
      addNotification,
      markNotificationRead,
      registerChatMessageHandler,
      registerChatSeenHandler,
      registerTrackingHandler,
      refetchNotifications,
      loadMoreNotifications,
      getSocket,
      socketStatus
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
