import React, { useCallback, useState } from 'react';
import { FaPlay, FaChevronRight } from 'react-icons/fa';
import DemoVideoModal from './DemoVideoModal.jsx';
import { fetchDemoVideoInfo } from '../../services/demoVideoService.js';
import { useLanguage } from '../../hooks/useLanguage.js';

/**
 * Segmented, form-field-style CTA for the official demo video (auth header, help, compact).
 */
const DemoVideoWatchButton = ({ className = '', variant = 'default' }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(null);

  const loadAndOpen = useCallback(async () => {
    try {
      const data = await fetchDemoVideoInfo();
      setInfo(data || {});
    } catch {
      setInfo({ hasVideo: false });
    }
    setOpen(true);
  }, []);

  const videoUrl = info?.hasVideo ? '/api/demo-video/stream' : null;

  const rootClass = [
    'tp-watch-demo-segmented',
    variant === 'authHeader' && 'tp-watch-demo-segmented--header',
    variant === 'compact' && 'tp-watch-demo-segmented--compact',
    variant === 'block' && 'tp-watch-demo-segmented--block',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <button
        type="button"
        className={rootClass}
        onClick={loadAndOpen}
        aria-label={t('common.watchDemo')}
      >
        <span className="tp-watch-demo-segmented__left">
          <FaPlay className="tp-watch-demo-segmented__play" aria-hidden />
          <span className="tp-watch-demo-segmented__label">{t('common.watchDemoCta')}</span>
        </span>
        <span className="tp-watch-demo-segmented__right" aria-hidden>
          <FaChevronRight className="tp-watch-demo-segmented__chevron" />
        </span>
      </button>
      <DemoVideoModal
        open={open}
        onClose={() => setOpen(false)}
        videoUrl={videoUrl}
        mimeType={info?.mimeType}
        emptyMessage={t('common.demoVideoUnavailable')}
      />
    </>
  );
};

export default DemoVideoWatchButton;
