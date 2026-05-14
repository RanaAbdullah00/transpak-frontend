import { useState, useCallback } from 'react';
import api from '../services/api.js';
import { unwrapBody } from '../utils/unwrapApi.js';
import { formatUserError } from '../utils/userErrors.js';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (config) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api(config);
      return unwrapBody(response.data);
    } catch (err) {
      setError(formatUserError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { request, loading, error };
};

