import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ADMIN_DASHBOARD_WIDGETS,
  EMPTY_ADMIN_DASHBOARD,
  fetchAdminDashboardResilient,
  fetchAdminWidget,
  mergeAdminDashboardWidgets,
  normalizeWidgetPayload
} from '../utils/adminDashboardApi.js';

const emptyWidgetState = () =>
  Object.fromEntries(
    ADMIN_DASHBOARD_WIDGETS.map((w) => [w, { widget: w, loading: false, data: null, error: null }])
  );

/**
 * Phase 3 admin dashboard — per-widget loading, retry, and merge.
 */
export function useAdminDashboardWidgets(request) {
  const [widgetState, setWidgetState] = useState(emptyWidgetState);
  const [initialLoading, setInitialLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const patchWidget = useCallback((widget, patch) => {
    setWidgetState((prev) => ({
      ...prev,
      [widget]: { ...prev[widget], widget, ...patch }
    }));
  }, []);

  const loadInFlightRef = useRef(null);
  const partialInFlightRef = useRef(null);

  const applyWidgetUpdates = useCallback(
    (widgets) => {
      setWidgetState((prev) => {
        const next = { ...prev };
        for (const w of widgets) {
          next[w] = { ...next[w], loading: true, error: null };
        }
        return next;
      });
    },
    []
  );

  const loadWidgets = useCallback(
    async (widgets) => {
      const list = (widgets || []).filter((w) => ADMIN_DASHBOARD_WIDGETS.includes(w));
      if (!list.length) return;
      if (partialInFlightRef.current) return partialInFlightRef.current;

      const run = (async () => {
        applyWidgetUpdates(list);
        try {
          await fetchAdminDashboardResilient(request, {
            widgets: list,
            skipFallback: true,
            onWidget: (widget, state) => {
              if (!mountedRef.current) return;
              patchWidget(widget, {
                loading: Boolean(state.loading),
                data: state.data ?? null,
                error: state.error ?? null,
                code: state.code ?? null,
                httpStatus: state.httpStatus ?? null,
                endpoint: state.endpoint ?? null,
                errorType: state.errorType ?? null,
                attempts: state.attempts ?? 0
              });
            }
          });
        } finally {
          partialInFlightRef.current = null;
        }
      })();

      partialInFlightRef.current = run;
      return run;
    },
    [request, patchWidget, applyWidgetUpdates]
  );

  const loadAll = useCallback(async () => {
    if (loadInFlightRef.current) {
      return loadInFlightRef.current;
    }

    const run = (async () => {
      setInitialLoading(true);
      setWidgetState((prev) => {
        const next = { ...prev };
        for (const w of ADMIN_DASHBOARD_WIDGETS) {
          next[w] = { ...next[w], loading: true, error: null };
        }
        return next;
      });

      try {
        await fetchAdminDashboardResilient(request, {
          onWidget: (widget, state) => {
            if (!mountedRef.current) return;
            patchWidget(widget, {
              loading: Boolean(state.loading),
              data: state.data ?? null,
              error: state.error ?? null,
              code: state.code ?? null,
              httpStatus: state.httpStatus ?? null,
              endpoint: state.endpoint ?? null,
              errorType: state.errorType ?? null,
              attempts: state.attempts ?? 0
            });
          }
        });
      } finally {
        if (mountedRef.current) setInitialLoading(false);
        loadInFlightRef.current = null;
      }
    })();

    loadInFlightRef.current = run;
    return run;
  }, [request, patchWidget]);

  const retryWidget = useCallback(
    async (widget) => {
      patchWidget(widget, { loading: true, error: null });
      try {
        const out = await fetchAdminWidget(request, widget);
        if (!mountedRef.current) return;
        patchWidget(widget, { loading: false, data: normalizeWidgetPayload(out.data), error: null, attempts: out.attempts });
      } catch (err) {
        if (!mountedRef.current) return;
        patchWidget(widget, {
          loading: false,
          error: err?.message || 'Unavailable',
          code: err?.code || null,
          httpStatus: err?.httpStatus ?? err?.response?.status ?? null,
          endpoint: err?.endpoint ?? null,
          errorType: err?.errorType ?? null,
          attempts: err?.attempt || 0
        });
      }
    },
    [request, patchWidget]
  );

  const live = useMemo(() => mergeAdminDashboardWidgets(widgetState), [widgetState]);
  const safeLive = live ?? EMPTY_ADMIN_DASHBOARD;

  const widgetFailed = useCallback(
    (id) => {
      const w = widgetState?.[id];
      if (w?.error && !w?.data) return true;
      if (w?.data?.partialFailure) return true;
      const stats = w?.data?.stats;
      if (stats && typeof stats === 'object') {
        const vals = Object.values(stats).filter((v) => v === null);
        if (vals.length > 0) return true;
      }
      return false;
    },
    [widgetState]
  );

  const widgetLoading = useCallback((id) => Boolean(widgetState?.[id]?.loading), [widgetState]);

  const connectionState = useMemo(() => {
    if (safeLive.authRequired) return 'offline';
    if (initialLoading && !safeLive.anyOk) return 'retrying';
    if (safeLive.allFailed) return 'offline';
    if (safeLive.meta?.partialFailure) return 'degraded';
    if (safeLive.anyOk) return 'live';
    return 'retrying';
  }, [safeLive, initialLoading]);

  return {
    widgetState,
    live: safeLive,
    initialLoading,
    loadAll,
    loadWidgets,
    retryWidget,
    widgetFailed,
    widgetLoading,
    connectionState,
    anyOk: safeLive.anyOk,
    allFailed: safeLive.allFailed,
    authRequired: safeLive.authRequired
  };
}
