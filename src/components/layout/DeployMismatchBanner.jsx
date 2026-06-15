import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';
import { resolveViteApiOrigin } from '../../config/apiConfig.js';

const RECHECK_MS = Number(import.meta.env.VITE_HEALTH_RECHECK_MS || 30000);

/** @typedef {'booting' | 'unavailable' | 'deploy-drift'} BannerMode */

const DeployMismatchBanner = () => {
  const { t } = useLanguage();
  /** @type {[BannerMode | null, Function]} */
  const [mode, setMode] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBooting = () => {
      setDismissed(false);
      setMode('booting');
    };
    const onUnavailable = () => {
      setDismissed(false);
      setMode('unavailable');
    };
    const onMismatch = () => {
      setDismissed(false);
      setMode('deploy-drift');
    };
    const onOk = () => {
      setMode(null);
      setDismissed(false);
    };
    window.addEventListener('tp:service-booting', onBooting);
    window.addEventListener('tp:service-unavailable', onUnavailable);
    window.addEventListener('tp:deploy-mismatch', onMismatch);
    window.addEventListener('tp:deploy-ok', onOk);
    return () => {
      window.removeEventListener('tp:service-booting', onBooting);
      window.removeEventListener('tp:service-unavailable', onUnavailable);
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
          setMode(null);
          setDismissed(false);
        }
      } catch {
        /* ignore — verifyDeploy handles unreachable API */
      }
    };

    const id = window.setInterval(poll, RECHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  if (!mode || dismissed) return null;

  const title =
    mode === 'booting'
      ? t('deploy.serverStartingTitle')
      : mode === 'unavailable'
        ? t('deploy.serverUnavailableTitle')
        : t('deploy.mismatchTitle');

  const body =
    mode === 'booting'
      ? t('deploy.serverStarting')
      : mode === 'unavailable'
        ? t('deploy.serverUnavailable')
        : t('deploy.mismatchBody');

  return (
    <div
      className="alert alert-warning border-0 rounded-0 mb-0 text-center small py-2 px-3 d-flex flex-wrap justify-content-center align-items-center gap-2"
      role="alert"
    >
      <div className="flex-grow-1">
        <strong>{title}</strong>
        <span className="d-block mt-1">{body}</span>
      </div>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        onClick={() => setDismissed(true)}
      >
        {t('common.close')}
      </button>
    </div>
  );
};

export default DeployMismatchBanner;
