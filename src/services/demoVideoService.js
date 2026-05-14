import api from './api.js';
import { unwrapResponseData } from '../utils/unwrapApi.js';

export async function fetchDemoVideoInfo() {
  const res = await api.get('/demo-video/info');
  return unwrapResponseData(res);
}

/** Admin only: replace official demo video on the server. */
export async function uploadOfficialDemoVideo(file) {
  const form = new FormData();
  form.append('video', file);
  const res = await api.post('/admin/demo-video', form);
  return unwrapResponseData(res);
}
