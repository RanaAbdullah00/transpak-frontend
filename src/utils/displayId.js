/**
 * Human-readable reference IDs for UI (maps existing L-###### codes to LOAD-######).
 */

export function formatLoadDisplayId(load) {
  const code = String(load?.code || load?.loadCode || '').trim();
  const m = code.match(/^L-(\d+)$/i);
  if (m) return `LOAD-${m[1].padStart(4, '0')}`;
  if (code) return code.toUpperCase();
  const id = String(load?.id || '').replace(/-/g, '').slice(0, 8);
  return id ? `LOAD-${id.toUpperCase()}` : 'LOAD';
}

export function formatBidDisplayId(bid) {
  const raw = bid?.displayId || bid?.id;
  if (!raw) return 'BID';
  const s = String(raw).replace(/-/g, '').slice(0, 8).toUpperCase();
  return `BID-${s}`;
}

export function formatShipmentDisplayId(shipment) {
  const loadCode = formatLoadDisplayId({ code: shipment?.loadCode });
  if (loadCode.startsWith('LOAD-')) return loadCode.replace(/^LOAD-/, 'SHP-');
  return 'SHP';
}
