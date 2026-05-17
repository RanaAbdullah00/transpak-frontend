import api from './api.js';
import { unwrapResponseData } from '../utils/unwrapApi.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function assertHttpsUrl(url) {
  const s = String(url || '').trim();
  if (!/^https:\/\//i.test(s)) {
    throw new Error('Upload must return a secure HTTPS URL');
  }
  return s;
}

async function uploadOnce(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post('/upload/media', fd);
  const data = unwrapResponseData(res);
  const url = data?.url || data?.secure_url;
  if (!url) throw new Error('Upload did not return a URL');
  return assertHttpsUrl(url);
}

/**
 * Upload a single file to Cloudinary via backend. Returns secure HTTPS URL.
 * Retries once on transient failure.
 */
export async function uploadMediaFile(file, { retries = 1 } = {}) {
  if (!file) throw new Error('No file');
  let lastErr;
  const attempts = Math.max(1, 1 + Number(retries) || 0);
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await uploadOnce(file);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(500);
    }
  }
  throw lastErr;
}
