import React, { useEffect, useState } from 'react';

function formatRelative(iso, locale) {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffSec = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}

const RelativeTime = ({ iso, className = '' }) => {
  const locale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en';
  const [label, setLabel] = useState(() => formatRelative(iso, locale));

  useEffect(() => {
    setLabel(formatRelative(iso, locale));
    const id = window.setInterval(() => setLabel(formatRelative(iso, locale)), 60000);
    return () => window.clearInterval(id);
  }, [iso, locale]);

  return (
    <time dateTime={iso} className={className} title={iso ? new Date(iso).toLocaleString() : ''}>
      {label}
    </time>
  );
};

export default RelativeTime;
