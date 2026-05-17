import api from './api.js';
import { unwrapResponseData } from '../utils/unwrapApi.js';

/** Upload a single file to Cloudinary via backend. Returns secure URL. */
export async function uploadMediaFile(file) {
  if (!file) throw new Error('No file');
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post('/upload/media', fd);
  const data = unwrapResponseData(res);
  const url = data?.url || data?.secure_url;
  if (!url) throw new Error('Upload did not return a URL');
  return String(url);
}
