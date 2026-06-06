/**
 * Frontend-only demo / presentation overrides.
 * Does NOT change backend validation — production stays strict when demo flags are off.
 */
import { unwrapErrorCode } from './unwrapApi.js';
import {
  commitOptimisticActivation,
  commitOptimisticBidAccept,
  emitScopedRefresh
} from './contractActivationLayer.js';
import { commitOptimisticStatusAdvance } from './shipmentStatusOptimistic.js';

const truthy = (v) => {
  const s = String(v || '').toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
};

/** Demo / presentation / FYP jury mode — fully disabled in production builds without these flags. */
export function isDemoPresentationMode() {
  return (
    truthy(import.meta.env.VITE_DEMO_MODE) ||
    truthy(import.meta.env.VITE_PRESENTATION_MODE) ||
    truthy(import.meta.env.VITE_FYP_MODE)
  );
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

/** Seed presentation timeline: Booked → Accepted → Picked → In Transit (Delivered shown as next). */
function seedDemoPresentationTimeline(loadCode) {
  const ref = String(loadCode || '').trim();
  if (!ref) return false;
  const steps = [
    { status: 'booked', label: 'Booked' },
    { status: 'booked', label: 'Accepted' },
    { status: 'pickedup', label: 'Picked' },
    { status: 'intransit', label: 'In Transit' }
  ];
  for (const step of steps) {
    commitOptimisticStatusAdvance(ref, step.status, { label: step.label });
  }
  return true;
}

/**
 * Simulate successful contract activation locally for jury presentation.
 * Uses existing optimistic activation + tracking pipeline only — no backend retry.
 */
export function applyDemoPresentationContract(load, extras = {}) {
  const loadCode = String(load?.code ?? load?.loadCode ?? extras.loadCode ?? '').trim();
  if (!loadCode) return false;

  const activationPayload = {
    loadCode,
    loadId: load?.id ?? extras.loadId ?? null,
    origin: load?.origin ?? extras.origin ?? null,
    destination: load?.destination ?? extras.destination ?? null,
    flowStatus: 'ACCEPTED',
    demoOverride: true
  };

  const activationExtras = {
    loadCode,
    origin: activationPayload.origin,
    destination: activationPayload.destination,
    carrierId: extras.carrierId ?? extras.userId ?? null,
    shipperId: extras.shipperId ?? null,
    userId: extras.userId ?? null,
    role: extras.role ?? null
  };

  commitOptimisticActivation(activationPayload, activationExtras);

  const bidId = String(extras.bidId || `demo-bid-${load?.id || loadCode}`).trim();
  commitOptimisticBidAccept(bidId, activationPayload, activationExtras);

  seedDemoPresentationTimeline(loadCode);

  emitScopedRefresh('bids');
  emitScopedRefresh('shipments');
  emitScopedRefresh('tracking');

  return true;
}

/**
 * Soft-capture VEHICLE_TYPE_MISMATCH in demo mode — never throws, never blocks UI.
 * Returns true when the error was handled as a demo soft-failure.
 */
export function captureDemoVehicleMismatch(err, load, onCapture) {
  if (!isDemoPresentationMode() || !isVehicleTypeMismatchError(err)) return false;
  logDemoMismatchSilently(err, { loadId: load?.id, loadCode: load?.code });
  if (typeof onCapture === 'function') onCapture(load);
  return true;
}
