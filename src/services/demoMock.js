import { isDemoMockApiEnabled } from '../utils/demoMode.js';
import {
  DEMO_LOAD_ID,
  demoLoad,
  demoBids,
  demoBidsCounter,
  demoLoadBooked,
  demoNotifications
} from '../data/demoFixtures.js';

function ok(data) {
  return { success: true, data };
}

/**
 * @returns {object|undefined} axios adapter response body root, or undefined to use real API
 */
export function resolveDemoMockResponse(config) {
  if (!isDemoMockApiEnabled()) return undefined;

  const method = String(config.method || 'get').toLowerCase();
  const path = String(config.url || '').split('?')[0];

  if (method === 'get' && path === '/notifications') {
    return ok(demoNotifications);
  }
  if (method === 'get' && path === '/notifications/unread-count') {
    return ok({ count: demoNotifications.filter((n) => !n.read).length });
  }
  if (method === 'get' && path.match(/^\/loads\/[^/]+$/)) {
    const id = path.split('/').pop();
    if (id === DEMO_LOAD_ID || id === 'demo') return ok(demoLoadBooked.status === 'booked' ? demoLoadBooked : demoLoad);
    return ok(demoLoad);
  }
  if (method === 'get' && path === '/loads') {
    return ok([demoLoad]);
  }
  if (method === 'get' && path === '/bids') {
    return ok(demoBidsCounter);
  }
  if (method === 'get' && path === '/bids/mine') {
    return ok(demoBids);
  }
  if (method === 'get' && path === '/operations/snapshot') {
    return ok({
      role: 'shipper',
      shipper: { openLoads: 1, activeShipments: 0, pendingBids: 1, completedDeliveries: 0 },
      carrier: null
    });
  }

  if (method === 'post' && path === '/loads') {
    return ok({ ...demoLoad, id: DEMO_LOAD_ID });
  }
  if (method === 'post' && path === '/bids') {
    return ok({ ...demoBids[0], flowStatus: 'PENDING_SHIPPER_CONFIRMATION' });
  }
  if (method === 'put' && path.match(/^\/bids\/[^/]+\/accept$/)) {
    return ok({ ok: true, flowStatus: 'ACCEPTED' });
  }

  return undefined;
}
