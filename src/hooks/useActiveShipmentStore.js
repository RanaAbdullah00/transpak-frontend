import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getActiveShipmentList,
  subscribeActiveShipmentStore
} from '../utils/activeShipmentStore.js';

import { getActiveShipmentEmptySnapshot } from '../utils/activeShipmentStore.js';

const EMPTY_ROWS = getActiveShipmentEmptySnapshot();

/**
 * Subscribe to ActiveShipmentStore — single in-memory read model for active shipments UI.
 */
export function useActiveShipmentStore() {
  const snapshot = useSyncExternalStore(
    subscribeActiveShipmentStore,
    getActiveShipmentList,
    getActiveShipmentList
  );

  return { rows: Array.isArray(snapshot) ? snapshot : EMPTY_ROWS, loading: false };
}

/** Legacy hook shape for gradual migration. */
export function useActiveShipmentRows() {
  const [rows, setRows] = useState(getActiveShipmentList);

  useEffect(() => subscribeActiveShipmentStore(setRows), []);

  return rows;
}
