import React from 'react';
import Modal from '../ui/Modal.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { getDemoVideoStreamUrl } from '../../utils/backendOrigin.js';

const DemoVideoModal = ({ open, onClose, videoUrl, mimeType, emptyMessage }) => {
  const { t } = useLanguage();
  const src = videoUrl || (open ? getDemoVideoStreamUrl() : null);

  return (
    <Modal open={open} onClose={onClose} title={t('common.watchDemo')} size="lg" closeLabel={t('common.close')}>
      {src ? (
        <video
          key={`${src}-${mimeType || 'video/mp4'}`}
          className="w-100 rounded-3 tp-demo-video"
          style={{ maxHeight: 'min(56vh, 520px)', background: 'var(--tp-video-bg, #0a0a0a)' }}
          controls
          playsInline
          preload="auto"
          muted
        >
          <source src={src} type={mimeType || 'video/mp4'} />
        </video>
      ) : (
        <p className="small text-muted mb-0">{emptyMessage || t('common.demoVideoUnavailable')}</p>
      )}
      <p className="small text-muted mt-2 mb-0">{t('common.demoVideoFooter')}</p>
    </Modal>
  );
};

export default DemoVideoModal;
