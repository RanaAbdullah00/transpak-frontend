import { kgToTons } from '../utils/weightUnits.js';
import { normalizeBidStatus, isCounterOffered } from '../utils/bidStatus.js';
import { estimateLocalFare } from '../utils/localFareEstimate.js';

// Data normalization adapters so UI never breaks on field mismatches.

function resolveLoadDistance(raw) {
  const fromApi = raw.distanceKm ?? raw.distance_km ?? raw.distance;
  const n = Number(fromApi);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  const origin = raw.origin ?? raw.pickup ?? '';
  const destination = raw.destination ?? raw.delivery ?? '';
  const est = estimateLocalFare(origin, destination, raw.vehicleType ?? raw.vehicle_type ?? 'Truck');
  if (est?.distanceKm > 0) return Math.round(est.distanceKm);
  return null;
}

export const normalizeLoad = (raw) => {
  if (!raw) return null;
  const id = raw.id ?? raw._id ?? raw.loadId ?? null;
  const price = Number(raw.price ?? raw.expectedPrice ?? raw.amount ?? 0);
  const weightKg = Number(raw.weight ?? raw.weightKg ?? 0);
  return {
    // canonical
    id,
    title: raw.title ?? raw.cargo ?? raw.description ?? 'Load',
    price,
    pickup: raw.pickup ?? raw.origin ?? '',
    delivery: raw.delivery ?? raw.destination ?? '',
    status: raw.status ?? 'open',
    shipperId: raw.shipperId ?? null,
    assignedCarrierId: raw.assignedCarrierId ?? null,
    // backward-compatible fields used by existing components
    code: raw.code ?? null,
    cargo: raw.cargo ?? raw.title ?? raw.description ?? 'Load',
    origin: raw.origin ?? raw.pickup ?? '',
    destination: raw.destination ?? raw.delivery ?? '',
    weight: kgToTons(weightKg),
    weightKg,
    vehicleType: raw.vehicleType ?? raw.type ?? 'Truck',
    distance: resolveLoadDistance(raw),
    distanceKm: resolveLoadDistance(raw),
    expectedPrice: price,
    pickupDate: raw.pickupDate ?? raw.date ?? '',
    deadlineHours: raw.deadlineHours != null ? raw.deadlineHours : 2,
    deadlineMinutes:
      raw.deadlineMinutes != null
        ? Number(raw.deadlineMinutes)
        : (raw.deadlineHours != null ? Number(raw.deadlineHours) * 60 : 120),
    biddingEndsAt: raw.biddingEndsAt ?? raw.bidding_ends_at ?? null,
    bidCount: Number(raw.bidCount ?? raw.bid_count ?? 0),
    deadline:
      raw.deadline ??
      raw.biddingEndsAt ??
      (() => {
        const created = raw.createdAt ?? raw.created_at;
        if (!created) return undefined;
        const mins =
          raw.deadlineMinutes != null
            ? Number(raw.deadlineMinutes)
            : Number(raw.deadlineHours != null ? raw.deadlineHours : 2) * 60;
        return new Date(new Date(created).getTime() + mins * 60000).toISOString();
      })()
  };
};

export const normalizeLoads = (arr) => (Array.isArray(arr) ? arr.map(normalizeLoad).filter(Boolean) : []);

export const normalizeBid = (raw) => {
  if (!raw) return null;
  const id = raw.id ?? raw._id ?? null;
  const price = Number(raw.price ?? raw.amount ?? 0);
  return {
    id,
    loadId: raw.loadId ?? raw.load ?? null,
    loadCode: raw.loadCode ?? raw.load_code ?? null,
    carrierId: raw.carrierId ?? raw.carrier ?? null,
    carrierName: raw.carrierName ?? raw.name ?? 'Carrier',
    shipperName: raw.shipperName ?? raw.shipper_name ?? null,
    carrierAvatar: raw.carrierAvatar ?? raw.carrierProfileImage ?? raw.carrier_avatar ?? null,
    shipperAvatar: raw.shipperAvatar ?? raw.shipperProfileImage ?? raw.shipper_avatar ?? null,
    shipperId: raw.shipperId ?? raw.shipper_id ?? null,
    vehicleType: raw.vehicleType ?? 'Truck',
    origin: raw.origin ?? raw.loadOrigin ?? null,
    destination: raw.destination ?? raw.loadDestination ?? null,
    transitTime: raw.transitTime ?? raw.etaDays ?? 2,
    price,
    amount: price,
    status: normalizeBidStatus(raw.status ?? raw.flowStatus ?? 'pending_shipper_confirmation'),
    flowStatus: raw.flowStatus ?? null,
    suggestedAmount: raw.suggestedAmount != null ? Number(raw.suggestedAmount) : null,
    suggestedAt: raw.suggestedAt ?? null,
    suggestedBy: raw.suggestedBy ?? null,
    bidType:
      raw.bidType === 'suggested' ||
      (isCounterOffered(raw.status) && raw.suggestedBy === 'carrier')
        ? 'suggested'
        : 'normal',
    createdAt: raw.createdAt ?? new Date().toISOString(),
    expiresAt: raw.expiresAt ?? raw.expires_at ?? null
  };
};

export const normalizeBids = (arr) => (Array.isArray(arr) ? arr.map(normalizeBid).filter(Boolean) : []);

export const normalizeNotification = (raw) => {
  if (!raw) return null;
  const rt = raw.roleType != null && String(raw.roleType).trim() !== '' ? String(raw.roleType).toLowerCase().trim() : null;
  const title = raw.title != null && String(raw.title).trim() !== '' ? String(raw.title).trim() : null;
  const ty =
    raw.type != null && String(raw.type).trim() !== ''
      ? String(raw.type).trim()
      : title;
  return {
    id: raw.id ?? raw._id ?? null,
    senderId: raw.senderId ?? null,
    receiverId: raw.receiverId ?? null,
    roleType: rt,
    type: ty,
    message: raw.message ?? title ?? '',
    title,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    read: Boolean(raw.read ?? raw.isRead)
  };
};

export const normalizeNotifications = (arr) =>
  (Array.isArray(arr) ? arr.map(normalizeNotification).filter(Boolean) : []);

export const normalizeTracking = (raw) => {
  if (!raw) return null;
  const t = raw.tracking || {};
  const loc = t.location != null ? t.location : t.currentLocation;
  const hasCoords =
    Array.isArray(loc) &&
    loc.length >= 2 &&
    Number.isFinite(Number(loc[0])) &&
    Number.isFinite(Number(loc[1]));
  const backendFlag = t.locationUnavailable === true;
  const locationUnavailable = backendFlag || !hasCoords;
  const safeLoc = hasCoords ? [Number(loc[0]), Number(loc[1])] : null;
  return {
    tracking: {
      ...t,
      status: t.status ?? 'posted',
      eta: t.eta,
      locationUnavailable,
      location: safeLoc,
      currentLocation: safeLoc,
      locationUpdatedAt: t.locationUpdatedAt ?? null,
      ts: raw.ts ?? t.ts ?? null
    },
    history: Array.isArray(raw.history) ? raw.history : [],
    liveTrackingMap: raw.liveTrackingMap || { coordinates: [] },
    origin: raw.origin || null,
    destination: raw.destination || null,
    refKey: raw.refKey != null ? String(raw.refKey) : null,
    loadId: raw.loadId != null ? String(raw.loadId) : null,
    lifecycleStage: raw.lifecycleStage ?? null,
    assignedCarrierId: raw.assignedCarrierId ?? raw.assigned_carrier_id ?? null,
    ts: raw.ts != null ? Number(raw.ts) : null
  };
};

