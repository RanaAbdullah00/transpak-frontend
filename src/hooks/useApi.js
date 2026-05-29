import { useState, useCallback } from 'react';
import api from '../services/api.js';
import { unwrapBody } from '../utils/unwrapApi.js';
import { formatUserError } from '../utils/userErrors.js';
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
      return unwrapBody(response.data);
    } catch (err) {
      const canceled =
        err?.code === 'ERR_CANCELED' ||
        err?.name === 'CanceledError' ||
        String(err?.message || '').toLowerCase() === 'canceled';
      if (canceled) throw err;
      logApiFailure(err, config);
      const msg = formatUserError(err);
      setError(msg);
      if (!skipToast) notifyApiError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { request, loading, error };
};

