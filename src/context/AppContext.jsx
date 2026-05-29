import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSocketClient } from '../services/socket.js';
import { normalizeNotification } from '../adapters/normalize.js';
import { isRenderableClientNotification, sanitizeNotificationRoleType } from '../utils/notificationsFilter.js';
import { notificationsForWorkspace } from '../utils/notificationScope.js';
import { routeRealtimeNotification } from '../utils/notifySystem.js';
import api from '../services/api.js';
import { unwrapResponseData } from '../utils/unwrapApi.js';
import { notifyApiError } from '../utils/notifySystem.js';
import { useAuth } from '../hooks/useAuth.js';
import { playNotificationSound } from '../utils/notificationSound.js';
import { getAuthToken } from '../utils/authTokenStorage.js';
import { workspaceQueryParams } from '../utils/workspaceApi.js';
import { getWorkspace } from '../utils/workspace.js';
import {
  shouldProcessRealtimeEvent,
  clearRealtimeDedupeCache,
  getLastNotificationSyncAt
} from '../utils/realtimeDedupe.js';
import { syncNotificationsSince, fetchUnreadCount } from '../utils/realtimeSync.js';
import { handleDispatchEvent } from '../utils/realtimeDispatch.js';
import { pruneWorkspaceQueryCaches } from '../utils/workspaceQueryCache.js';

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
  const socketConnectedRef = useRef(false);
  const addNotificationRef = useRef(null);

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
    if (eid && !shouldProcessRealtimeEvent(eid)) return;
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
      return user ? notificationsForWorkspace(next, user) : next;
    });
    if (showToast) routeRealtimeNotification(normalized);
  }, [user?.id, user?.activeRole]);

  addNotificationRef.current = (n) => addNotification(n, { showToast: true });

  const markNotificationRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => {
        const nid = n.id ?? n._id;
        return nid === id || String(nid) === String(id) ? { ...n, read: true, isRead: true } : n;
      })
    );
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setNotifications([]);
      return undefined;
    }

    setNotifications([]);
    setNotificationsCursor(null);
    setNotificationsHasMore(false);
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/notifications', {
          params: { limit: 30, ...workspaceQueryParams(user) },
          skipGlobalErrorToast: true
        });
        if (cancelled) return;
        const page = normalizeNotificationsPayload(unwrapResponseData(res));
        setNotifications(page.items.map(mapNotificationRow));
        setNotificationsCursor(page.nextCursor);
        setNotificationsHasMore(page.hasMore);
      } catch (err) {
        if (err?.response?.status !== 401) notifyApiError(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.activeRole, sessionVersion]);

  const mergeNotificationsFromServer = useCallback((rows) => {
    if (!Array.isArray(rows)) return;
    const mapped = rows.map(mapNotificationRow);
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
    if (!user?.id) return;
    try {
      const since = getLastNotificationSyncAt();
      const out = await syncNotificationsSince(user, since ? { since } : {});
      mergeNotificationsFromServer(out.items);
      window.dispatchEvent(
        new CustomEvent('tp:unread-sync', { detail: { count: out.unreadCount } })
      );
    } catch (err) {
      if (err?.response?.status !== 401) {
        /* optional — list refetch still runs */
      }
    }
  }, [user, mergeNotificationsFromServer]);

  const refetchNotifications = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await api.get('/notifications', {
        params: { limit: 30, ...workspaceQueryParams(user) },
        skipGlobalErrorToast: true
      });
      const page = normalizeNotificationsPayload(unwrapResponseData(res));
      mergeNotificationsFromServer(page.items);
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
        params: { limit: 30, cursor: notificationsCursor, ...workspaceQueryParams(user) },
        skipGlobalErrorToast: true
      });
      const page = normalizeNotificationsPayload(unwrapResponseData(res));
      mergeNotificationsFromServer(page.items);
      setNotificationsCursor(page.nextCursor);
      setNotificationsHasMore(page.hasMore);
    } catch (err) {
      if (err?.response?.status !== 401) notifyApiError(err);
    } finally {
      setNotificationsLoadingMore(false);
    }
  }, [notificationsCursor, notificationsHasMore, notificationsLoadingMore, mergeNotificationsFromServer, user]);

  useEffect(() => {
    const onRefresh = () => refetchNotifications();
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
    if (!user?.id) return undefined;

    const reconcileMs = Number(import.meta.env.VITE_CACHE_RECONCILE_MS || 300000);
    const reconcileId = window.setInterval(async () => {
      pruneWorkspaceQueryCaches();
      try {
        const count = await fetchUnreadCount(user);
        window.dispatchEvent(new CustomEvent('tp:unread-sync', { detail: { count } }));
      } catch {
        /* offline */
      }
    }, reconcileMs);

    return () => window.clearInterval(reconcileId);
  }, [user?.id, user?.activeRole]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const pollMs = Number(import.meta.env.VITE_NOTIFICATION_POLL_MS || 28000);
    const pollId = window.setInterval(async () => {
      if (socketConnectedRef.current) return;
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

  useEffect(() => {
    const token = getAuthToken();
    const workspaceScoped = (row) => {
      if (!user) return true;
      const rt = row?.roleType != null ? String(row.roleType).toLowerCase() : '';
      const active = getWorkspace(user);
      if (!rt) return true;
      if (active === 'admin') return rt === 'admin';
      return rt === active;
    };

    const ingestNotification = (n) => {
      if (!workspaceScoped(n)) return;
      if (n?.eventId && !shouldProcessRealtimeEvent(n.eventId)) return;
      addNotificationRef.current?.(n);
      window.dispatchEvent(new CustomEvent('tp:notification-sound'));
      playNotificationSound();
    };

    const client = createSocketClient({
      token: token || undefined,
      workspace: user ? getWorkspace(user) : null,
      onConnectionChange: (connected) => {
        socketConnectedRef.current = Boolean(connected);
      },
      onReconnect: async () => {
        await refetchNotifications();
        await syncReconnectNotifications();
      },
      onDispatch: (d) => {
        if (d?.scope?.workspace && user) {
          const active = getWorkspace(user);
          if (String(d.scope.workspace).toLowerCase() !== active) return;
        }
        if (d?.eventId && !shouldProcessRealtimeEvent(d.eventId)) return;
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
    return () => {
      client.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, user?.activeRole, sessionVersion, refetchNotifications, syncReconnectNotifications]);

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
      getSocket
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
      getSocket
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
