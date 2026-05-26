import React, { useCallback, useEffect, useState } from 'react';
import { fetchDemoVideoInfo, uploadOfficialDemoVideo } from '../../services/demoVideoService.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';

const AdminDemoVideoManager = () => {
  const { t } = useLanguage();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDemoVideoInfo();
      setInfo(data);
    } catch {
      setInfo({ hasVideo: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      notifyError(t('pages.admin.demoVideoTypeError'));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      notifyError(t('pages.admin.demoVideoSizeError'));
      return;
    }
    setUploading(true);
    try {
      await uploadOfficialDemoVideo(file);
      notifySuccess(t('pages.admin.demoVideoUploaded'));
      await refresh();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.admin.demoVideoUploadFailed') }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm rounded-3">
      <div className="card-body">
        <h6 className="fw-semibold mb-2">{t('pages.admin.demoVideoTitle')}</h6>
        <p className="small text-muted mb-3">{t('pages.admin.demoVideoLead')}</p>
        {loading ? (
          <div className="small text-muted">{t('common.loading')}</div>
        ) : (
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span
              className={`badge rounded-pill ${info?.hasVideo ? 'bg-success' : 'bg-secondary'}`}
            >
              {info?.hasVideo ? t('pages.admin.demoVideoActive') : t('pages.admin.demoVideoNone')}
            </span>
            <label className="btn btn-primary btn-sm rounded-lg mb-0">
              {uploading ? t('pages.profile.uploading') : t('pages.admin.demoVideoUpload')}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="d-none"
                disabled={uploading}
                onChange={onFile}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDemoVideoManager;
