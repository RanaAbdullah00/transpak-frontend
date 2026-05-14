import api from './api.js';

// Bid-related API calls.
export const createBid = (payload) =>
  api.post('/bids', payload);

export const fetchBids = (params) =>
  api.get('/bids', { params });

