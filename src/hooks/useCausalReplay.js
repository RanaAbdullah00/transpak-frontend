import { useCallback, useEffect, useState } from 'react';
import api from '../services/api.js';

/**
 * Read-only causal replay hook for DEV debug panel.
 */
export function useCausalReplay(shipmentId, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const id = String(shipmentId || '').trim();
    if (!id || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/replay/shipment/${encodeURIComponent(id)}`, {
        skipGlobalErrorToast: true
      });
      setData(res.data || res);
    } catch (err) {
      setError(err?.message || 'Failed to load replay');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [shipmentId, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
