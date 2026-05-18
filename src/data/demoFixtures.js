/** Static fixtures for FYP demo / mock API mode only. */

export const DEMO_LOAD_ID = 'demo-load-001';
export const DEMO_BID_ID = 'demo-bid-001';

export const demoLoad = {
  id: DEMO_LOAD_ID,
  code: 'L-482910',
  cargo: 'FMCG pallets — Lahore to Karachi',
  origin: 'Lahore',
  destination: 'Karachi',
  weight: 18,
  vehicleType: 'Truck',
  expectedPrice: 185000,
  pickupDate: '2026-05-20',
  deadlineHours: 24,
  status: 'open',
  shipperId: 'demo-shipper',
  distanceKm: 1210,
  suggestedFare: 182000,
  createdAt: '2026-05-15T09:00:00.000Z',
  updatedAt: '2026-05-15T10:30:00.000Z'
};

export const demoBids = [
  {
    id: DEMO_BID_ID,
    loadId: DEMO_LOAD_ID,
    carrierId: 'demo-carrier',
    carrierName: 'Ali Transport',
    amount: 185000,
    status: 'pending_shipper_confirmation',
    suggestedAmount: null,
    suggestedBy: null,
    createdAt: '2026-05-15T10:15:00.000Z'
  }
];

export const demoBidsCounter = [
  {
    ...demoBids[0],
    status: 'counter_offered',
    suggestedAmount: 195000,
    suggestedBy: 'carrier'
  }
];

export const demoLoadBooked = {
  ...demoLoad,
  status: 'booked',
  assignedCarrierId: 'demo-carrier'
};

export const demoNotifications = [
  {
    id: 'demo-n1',
    type: 'LOAD_POSTED',
    title: 'LOAD_POSTED',
    message: 'New load L-482910: Lahore → Karachi',
    read: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'demo-n2',
    type: 'BID_RECEIVED',
    title: 'SHIPPER_CONFIRMATION_REQUEST',
    message: 'Carrier bid PKR 185,000 — confirm to book',
    read: false,
    createdAt: new Date().toISOString()
  }
];
