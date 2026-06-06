/**
 * Frontend-only demo / presentation overrides.
 * Does NOT change backend validation — production stays strict when demo flags are off.
 */
import { unwrapErrorCode } from './unwrapApi.js';
import {
  commitOptimisticBidAccept,
  emitScopedRefresh
} from './contractActivationLayer.js';

export function isDemoPresentationMode() {
  const demo = String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase();
  const presentation = String(import.meta.env.VITE_PRESENTATION_MODE || '').toLowerCase();
  return demo === 'true' || demo === '1' || presentation === 'true' || presentation === '1';
}

export function isVehicleTypeMismatchError(err) {
  const code = unwrapErrorCode(err);
  if (code === 'VEHICLE_TYPE_MISMATCH') return true;
  const msg = String(err?.message || err?.response?.data?.message || '').toLowerCase();
  return /vehicle type|matching this load vehicle type|fleet has no truck matching/.test(msg);
}

/** Silent console log only — never surfaces raw API text to users in demo mode. */
export function logDemoMismatchSilently(err, context = {}) {
  if (import.meta.env.DEV || isDemoPresentationMode()) {
    // eslint-disable-next-line no-console
    console.info('[demo] VEHICLE_TYPE_MISMATCH (UI override available)', {
      code: unwrapErrorCode(err),
      ...context
    });
  }
}

/**
 * Simulate successful contract activation locally for jury presentation.
 * Uses existing optimistic activation + tracking pipeline only.
 */
export function applyDemoPresentationContract(load, extras = {}) {
  const loadCode = String(load?.code ?? load?.loadCode ?? extras.loadCode ?? '').trim();
  if (!loadCode) return false;

  const payload = {
    loadCode,
    loadId: load?.id ?? extras.loadId ?? null,
    origin: load?.origin ?? extras.origin ?? null,
    destination: load?.destination ?? extras.destination ?? null,
    flowStatus: 'ACCEPTED',
    demoOverride: true
  };

  const bidId = String(extras.bidId || `demo-bid-${load?.id || loadCode}`).trim();
  commitOptimisticBidAccept(bidId, payload, {
    loadCode,
    origin: payload.origin,
    destination: payload.destination,
    carrierId: extras.carrierId ?? extras.userId ?? null,
    shipperId: extras.shipperId ?? null,
    userId: extras.userId ?? null,
    role: extras.role ?? null
  });

  emitScopedRefresh('bids');
  emitScopedRefresh('shipments');
  emitScopedRefresh('tracking');

  return true;
}
