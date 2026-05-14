import { useCallback, useState } from 'react';
import { uploadDocumentApi, uploadImageApi, uploadImagesMultipleApi } from '../services/uploadApi.js';

export function useCloudinaryUpload() {
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const uploadImage = useCallback(async (file) => {
    setBusy(true);
    setProgress(0);
    try {
      return await uploadImageApi(file, setProgress);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, []);

  const uploadImages = useCallback(async (files) => {
    setBusy(true);
    setProgress(0);
    try {
      return await uploadImagesMultipleApi(files, setProgress);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, []);

  const uploadPdf = useCallback(async (file) => {
    setBusy(true);
    setProgress(0);
    try {
      return await uploadDocumentApi(file, setProgress);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, []);

  return { uploadImage, uploadImages, uploadPdf, progress, busy };
}
