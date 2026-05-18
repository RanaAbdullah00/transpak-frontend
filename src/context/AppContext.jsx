import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSocketClient } from '../services/socket.js';
import { normalizeNotification } from '../adapters/normalize.js';
import { isRenderableClientNotification, sanitizeNotificationRoleType } from '../utils/notificationsFilter.js';
import { notifyInfo } from '../components/ui/ToastProvider.jsx';
import api from '../services/api.js';
import { useAuth } from '../hooks/useAuth.js';

export const AppContext = createContext(null);

function mapNotificationRow(r) {
  const title = r.title != null && String(r.title).trim() !== '' ? String(r.title).trim() : null;
  const type = r.type != null && String(r.type).trim() !== '' ? String(r.type).trim() : title;
  return {
    id: r.id || r._id,
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
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const chatMessageHandlers = useRef(new Set());
  const chatSeenHandlers = useRef(new Set());
  const trackingHandlers = useRef(new Set());
  const lastTrackingSig = useRef({ sig: '', t: 0 });
  const socketRef = useRef(null);
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
    const nid = normalized.id ?? normalized._id;
    setNotifications((prev) => {
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
      return [{ id: nid ?? `local-${Date.now()}`, read: Boolean(normalized.read), ...normalized }, ...prev];
    });
    if (showToast && normalized.message) {
      notifyInfo(normalized.message);
    }
  }, []);

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
    const token = localStorage.getItem('transpak_token');
    if (!token) {
      setNotifications([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/notifications');
        if (cancelled) return;
        const rows = res?.data;
        if (!Array.isArray(rows)) return;
        setNotifications(rows.map(mapNotificationRow));
      } catch {
        // keep empty; socket may still deliver
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const refetchNotifications = useCallback(async () => {
    const token = localStorage.getItem('transpak_token');
    if (!token) return;
    try {
      const res = await api.get('/notifications');
      const rows = res?.data;
      if (!Array.isArray(rows)) return;
      setNotifications(rows.map(mapNotificationRow));
    } catch {
      /* keep current */
    }
  }, []);

  useEffect(() => {
    const onRefresh = () => refetchNotifications();
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [refetchNotifications]);

  useEffect(() => {
    const token = localStorage.getItem('transpak_token');
    const client = createSocketClient({
      token: token || undefined,
      onReconnect: refetchNotifications,
      onNotification: (n) => {
        if (n?.items && Array.isArray(n.items)) {
          n.items.forEach((item) => addNotificationRef.current?.(item));
          return;
        }
        addNotificationRef.current?.(n);
      },
      onTracking: (p) => {
        const sig = `${p?.refKey}|${p?.tracking?.status}|${JSON.stringify(p?.tracking?.currentLocation ?? p?.tracking?.location)}|${(p?.history || []).length}`;
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
  }, [user?.id, refetchNotifications]);

  const getSocket = useCallback(() => socketRef.current, []);

  const value = useMemo(
    () => ({
      notifications,
      addNotification,
      markNotificationRead,
      registerChatMessageHandler,
      registerChatSeenHandler,
      registerTrackingHandler,
      getSocket
    }),
    [
      notifications,
      addNotification,
      markNotificationRead,
      registerChatMessageHandler,
      registerChatSeenHandler,
      registerTrackingHandler,
      getSocket
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
