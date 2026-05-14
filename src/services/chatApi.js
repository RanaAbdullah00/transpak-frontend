import api from './api.js';

export async function fetchConversations() {
  const res = await api.get('/chat/conversations');
  return res.data;
}

export async function fetchMessages(conversationId, { before, limit } = {}) {
  const res = await api.get(`/chat/conversations/${conversationId}/messages`, {
    params: { before, limit }
  });
  return res.data;
}

export async function openConversation({ peerUserId, loadId }) {
  const res = await api.post('/chat/conversations/open', { peerUserId, loadId });
  const d = res.data || {};
  if (d.id && !d.conversationId) return { ...d, conversationId: d.id };
  return d;
}

/**
 * @param {string} conversationId
 * @param {{ body?: string, clientMessageId?: string, attachment?: { url: string, publicId: string, kind: 'image'|'pdf', fileName?: string } }} payload
 */
export async function sendMessageHttp(conversationId, payload) {
  const res = await api.post(`/chat/conversations/${conversationId}/messages`, payload);
  return res.data;
}

export async function markConversationReadHttp(conversationId, upToMessageId) {
  const res = await api.post(`/chat/conversations/${conversationId}/read`, {
    upToMessageId
  });
  return res.data;
}
