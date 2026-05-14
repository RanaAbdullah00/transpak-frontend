import { useLanguage } from '../../hooks/useLanguage.js';

/**
 * Reusable translated label for the official demo video.
 * Use with DemoVideoModal / DemoVideoWatchButton for consistent branding.
 */
export function useWatchDemoLabel() {
  const { t } = useLanguage();
  return t('common.watchDemoCta');
}

export default function WatchDemoLabel() {
  const label = useWatchDemoLabel();
  return <span className="fw-semibold small">{label}</span>;
}
