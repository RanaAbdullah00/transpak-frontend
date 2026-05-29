import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ADMIN_DASHBOARD_WIDGETS,
  fetchAdminDashboardResilient,
  fetchAdminWidget,
  mergeAdminDashboardWidgets
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

  const loadAll = useCallback(async () => {
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
            attempts: state.attempts ?? 0
          });
        }
      });
    } finally {
      if (mountedRef.current) setInitialLoading(false);
    }
  }, [request, patchWidget]);

  const retryWidget = useCallback(
    async (widget) => {
      patchWidget(widget, { loading: true, error: null });
      try {
        const out = await fetchAdminWidget(request, widget);
        if (!mountedRef.current) return;
        patchWidget(widget, { loading: false, data: out.data, error: null, attempts: out.attempts });
      } catch (err) {
        if (!mountedRef.current) return;
        patchWidget(widget, {
          loading: false,
          error: err?.message || 'Unavailable',
          code: err?.code || null,
          attempts: err?.attempt || 0
        });
      }
    },
    [request, patchWidget]
  );

  const live = useMemo(() => mergeAdminDashboardWidgets(widgetState), [widgetState]);

  const widgetFailed = useCallback(
    (id) => Boolean(widgetState[id]?.error && !widgetState[id]?.data),
    [widgetState]
  );

  const widgetLoading = useCallback((id) => Boolean(widgetState[id]?.loading), [widgetState]);

  return {
    widgetState,
    live,
    initialLoading,
    loadAll,
    retryWidget,
    widgetFailed,
    widgetLoading,
    anyOk: live.anyOk,
    allFailed: live.allFailed
  };
}
