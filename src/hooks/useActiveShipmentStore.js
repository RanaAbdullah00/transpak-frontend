import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getActiveShipmentList,
  subscribeActiveShipmentStore
} from '../utils/activeShipmentStore.js';

/**
 * Subscribe to ActiveShipmentStore — single in-memory read model for active shipments UI.
 */
export function useActiveShipmentStore() {
  const rows = useSyncExternalStore(
    subscribeActiveShipmentStore,
    getActiveShipmentList,
    getActiveShipmentList
  );

  return { rows, loading: false };
}

/** Legacy hook shape for gradual migration. */
export function useActiveShipmentRows() {
  const [rows, setRows] = useState(getActiveShipmentList);

  useEffect(() => subscribeActiveShipmentStore(setRows), []);

  return rows;
}
