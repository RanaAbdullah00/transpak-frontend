import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';

const DeployMismatchBanner = () => {
  const { t } = useLanguage();
  const [mismatch, setMismatch] = useState(false);
  const [detail, setDetail] = useState('');

  useEffect(() => {
    const onMismatch = (e) => {
      setMismatch(true);
      setDetail(e?.detail?.message || '');
    };
    window.addEventListener('tp:deploy-mismatch', onMismatch);
    return () => window.removeEventListener('tp:deploy-mismatch', onMismatch);
  }, []);

  if (!mismatch) return null;

  return (
    <div
      className="alert alert-warning border-0 rounded-0 mb-0 text-center small py-2 px-3"
      role="alert"
    >
      <strong>{t('deploy.mismatchTitle')}</strong>
      <span className="d-block mt-1">{detail || t('deploy.mismatchBody')}</span>
    </div>
  );
};

export default DeployMismatchBanner;
