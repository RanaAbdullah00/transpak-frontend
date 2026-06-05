import { useState, useCallback } from 'react';
import api from '../services/api.js';
import { unwrapBody, ensureAdminList } from '../utils/unwrapApi.js';
import { mapError } from '../utils/mapError.js';
import { notifyApiError } from '../utils/notifySystem.js';
import { logApiFailure } from '../utils/apiDevLog.js';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (config) => {
    const skipToast = config?.skipGlobalErrorToast === true;
    setLoading(true);
    setError(null);
    try {
      const response = await api({ ...config, skipGlobalErrorToast: skipToast });
      const data = unwrapBody(response.data);
      if (config?.expectList) return ensureAdminList(data, config.listKey);
      return data ?? {};
    } catch (err) {
      const canceled =
        err?.code === 'ERR_CANCELED' ||
        err?.name === 'CanceledError' ||
        String(err?.message || '').toLowerCase() === 'canceled';
      if (canceled) throw err;
      logApiFailure(err, config);
      const mapped = mapError(err);
      setError(mapped.message);
      if (!skipToast) notifyApiError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { request, loading, error };
};

