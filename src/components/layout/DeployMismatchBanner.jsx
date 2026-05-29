import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';
import { resolveViteApiOrigin } from '../../config/apiConfig.js';

const RECHECK_MS = Number(import.meta.env.VITE_HEALTH_RECHECK_MS || 30000);

const DeployMismatchBanner = () => {
  const { t } = useLanguage();
  const [mismatch, setMismatch] = useState(false);
  const [detail, setDetail] = useState('');

  useEffect(() => {
    const onMismatch = (e) => {
      setMismatch(true);
      setDetail(e?.detail?.message || '');
    };
    const onOk = () => {
      setMismatch(false);
      setDetail('');
    };
    window.addEventListener('tp:deploy-mismatch', onMismatch);
    window.addEventListener('tp:deploy-ok', onOk);
    return () => {
      window.removeEventListener('tp:deploy-mismatch', onMismatch);
      window.removeEventListener('tp:deploy-ok', onOk);
    };
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) return undefined;

    const apiOrigin = resolveViteApiOrigin();
    if (!apiOrigin) return undefined;

    const poll = async () => {
      try {
        const res = await fetch(`${apiOrigin.replace(/\/$/, '')}/api/health`, { cache: 'no-store' });
        const body = await res.json();
        const db = body?.data?.db;
        const schema = body?.data?.schema;
        if (db === 'ready' && schema?.ok === true) {
          setMismatch(false);
          setDetail('');
        }
        if (db === 'connecting' || schema?.booting === true) {
          setMismatch(false);
        }
      } catch {
        /* ignore */
      }
    };

    const id = window.setInterval(poll, RECHECK_MS);
    return () => window.clearInterval(id);
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
