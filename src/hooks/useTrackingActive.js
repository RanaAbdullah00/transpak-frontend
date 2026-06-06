import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { findActiveShipmentRow } from '../utils/activeShipmentModel.js';
import {
  getActiveShipmentList,
  subscribeActiveShipmentStore
} from '../utils/activeShipmentStore.js';
import {
  hasOptimisticActivation,
  subscribeOptimisticActivation
} from '../utils/contractActivationLayer.js';
import { getUnifiedShipmentSnapshot } from '../utils/shipmentUIState.js';
import { resolveTrackingActive } from '../utils/trackingActiveGate.js';

/**
 * Reactive tracking gate — re-evaluates on optimistic activation, contract events, and store rows.
 * View layer only; does not modify activation or snapshot engines.
 */
export function useTrackingActive({
  trackRef,
  restRow = null,
  role = null,
  userId = null
} = {}) {
  const [activationTick, bumpActivation] = useState(0);
  const [contractTick, bumpContract] = useState(0);

  useEffect(() => subscribeOptimisticActivation(() => bumpActivation((n) => n + 1)), []);

  useEffect(() => {
    const onActivated = (e) => {
      const ref = String(e?.detail?.ref || '').trim();
      const key = String(trackRef || '').trim();
      if (!key || !ref || ref !== key) return;
      bumpActivation((n) => n + 1);
      bumpContract((n) => n + 1);
    };
    window.addEventListener('tp:contract-activated', onActivated);
    return () => window.removeEventListener('tp:contract-activated', onActivated);
  }, [trackRef]);

  const storeRows = useSyncExternalStore(
    subscribeActiveShipmentStore,
    getActiveShipmentList,
    getActiveShipmentList
  );

  return useMemo(() => {
    const ref = String(trackRef || '').trim();
    const storeRow = ref ? findActiveShipmentRow(storeRows, ref) : null;
    const shipmentRow = restRow || storeRow || null;
    const pageSnapshot = ref
      ? getUnifiedShipmentSnapshot({
          restRow: shipmentRow,
          storeRow,
          ref,
          role,
          userId
        })
      : null;

    const optimisticActivation = ref ? hasOptimisticActivation(ref) : false;
    const contractActivated =
      optimisticActivation || Boolean(pageSnapshot?.contractActivated);
    const shipmentRowExists = Boolean(shipmentRow || storeRow || pageSnapshot?.activeRow);
    const trackingActive = resolveTrackingActive({
      contractActivated,
      optimisticActivation,
      shipmentRowExists
    });

    return {
      trackingActive,
      contractActivated,
      optimisticActivation,
      shipmentRowExists,
      storeRow,
      shipmentRow: shipmentRow || pageSnapshot?.activeRow || null,
      pageSnapshot
    };
  }, [trackRef, restRow, role, userId, activationTick, contractTick, storeRows]);
}
