import React, { useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useCloudinaryUpload } from '../../hooks/useCloudinaryUpload.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import SafeImage from '../ui/SafeImage.jsx';
import { formatUserError } from '../../utils/userErrors.js';

/**
 * Generic authenticated Cloudinary upload (image). Calls onComplete({ url, publicId }).
 */
const FileUploadField = ({
  accept = 'image/jpeg,image/png,image/webp',
  variant = 'image',
  onComplete,
  className = '',
  disabled = false
}) => {
  const { t } = useLanguage();
  const inputRef = useRef(null);
  const { uploadImage, uploadPdf, progress, busy } = useCloudinaryUpload();
  const [preview, setPreview] = useState('');

  const run = async (file) => {
    if (!file) return;
    try {
      const data =
        variant === 'pdf'
          ? await uploadPdf(file)
          : await uploadImage(file);
      const url = data?.url;
      const publicId = data?.publicId;
      if (url && typeof onComplete === 'function') onComplete({ url, publicId, raw: data });
      if (variant !== 'pdf' && url) setPreview(url);
      notifySuccess(t('pages.upload.success'));
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.upload.failed') }));
    }
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    run(f);
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        className="d-none"
        accept={accept}
        disabled={disabled || busy}
        onChange={onPick}
      />
      <Button
        type="button"
        variant="outline-primary"
        className="btn-sm rounded-lg"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy
          ? t('pages.upload.uploading')
          : variant === 'pdf'
            ? t('pages.upload.uploadPdf')
            : t('pages.upload.uploadImage')}
      </Button>
      {busy && progress > 0 ? (
        <div className="small text-muted mt-1">{t('pages.upload.progress', { pct: String(progress) })}</div>
      ) : null}
      {preview && variant !== 'pdf' ? (
        <SafeImage
          src={preview}
          alt=""
          className="rounded border mt-2 w-100"
          style={{ maxHeight: 140, objectFit: 'cover', minHeight: 80 }}
        />
      ) : null}
    </div>
  );
};

export default FileUploadField;
