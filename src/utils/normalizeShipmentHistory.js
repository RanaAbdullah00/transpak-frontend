import { normalizeShipmentStatus } from './shipmentStatus.js';

/**
 * Unified history row for shipper and carrier dashboards.
 */
export function normalizeShipmentHistory(record = {}, { carrierMode = false } = {}) {
  const raw = record && typeof record === 'object' ? record : {};
  const code = String(
    raw.code ?? raw.shipmentRef ?? raw.ref ?? raw.loadCode ?? raw.id ?? ''
  ).trim();
  const id = raw.id ?? code ?? `hist-${Date.now()}`;
  const unifiedStatus = normalizeShipmentStatus(
    raw.unifiedStatus ?? raw.shipmentStatus ?? raw.status
  );

  const origin = String(raw.origin ?? raw.from ?? raw.pickupCity ?? '').trim();
  const destination = String(
    raw.destination ?? raw.to ?? raw.deliveryCity ?? ''
  ).trim();

  const cargo = String(
    raw.cargo ?? raw.description ?? raw.title ?? code ?? '—'
  ).trim();

  const counterpartyName = carrierMode
    ? raw.shipperName ?? raw.shipper?.name ?? raw.shipperCompany ?? ''
    : raw.carrierName ?? raw.carrier?.name ?? raw.carrierCompany ?? '';

  const counterpartyId = carrierMode
    ? raw.shipperId ?? raw.shipper_id ?? null
    : raw.assignedCarrierId ?? raw.assigned_carrier_id ?? raw.carrierId ?? null;

  const counterpartyAvatar = carrierMode
    ? raw.shipperAvatar ?? raw.shipperProfileImage ?? null
    : raw.carrierAvatar ?? raw.carrierProfileImage ?? null;

  return {
    id,
    code: code || String(id),
    shipmentRef: code || String(id),
    cargo,
    origin,
    destination,
    unifiedStatus: unifiedStatus || 'unknown',
    status: unifiedStatus || 'unknown',
    role: carrierMode ? 'carrier' : 'shipper',
    counterpartyName: String(counterpartyName || '').trim(),
    counterpartyId: counterpartyId ? String(counterpartyId) : null,
    counterpartyAvatar: counterpartyAvatar || null,
    completedAt: raw.completedAt ?? raw.deliveredAt ?? raw.updatedAt ?? raw.createdAt ?? null,
    _raw: raw
  };
}

export function normalizeShipmentHistoryList(rows = [], options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row) => normalizeShipmentHistory(row, options));
}
