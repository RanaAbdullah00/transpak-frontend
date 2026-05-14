import api from './api.js';

/**
 * @param {File} file
 * @param {(pct: number) => void} [onProgress]
 */
export async function uploadImageApi(file, onProgress) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post('/upload/image', fd, {
    onUploadProgress: (evt) => {
      if (typeof onProgress !== 'function' || !evt.total) return;
      onProgress(Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
    }
  });
  return res?.data;
}

/**
 * @param {File[]} files
 * @param {(pct: number) => void} [onProgress]
 */
export async function uploadImagesMultipleApi(files, onProgress) {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  const res = await api.post('/upload/multiple', fd, {
    onUploadProgress: (evt) => {
      if (typeof onProgress !== 'function' || !evt.total) return;
      onProgress(Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
    }
  });
  return res?.data;
}

/**
 * @param {File} file
 * @param {(pct: number) => void} [onProgress]
 */
export async function uploadDocumentApi(file, onProgress) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post('/upload/document', fd, {
    onUploadProgress: (evt) => {
      if (typeof onProgress !== 'function' || !evt.total) return;
      onProgress(Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
    }
  });
  return res?.data;
}

/**
 * @param {string} publicId
 * @param {'image'|'raw'} [resourceType]
 */
export async function deleteUploadedAssetApi(publicId, resourceType = 'image') {
  const res = await api.delete('/upload', {
    params: { publicId, resourceType }
  });
  return res?.data;
}
