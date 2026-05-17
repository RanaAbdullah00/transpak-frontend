import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { getPortalContainer } from '../../utils/portalRoot.js';

const ConfirmActionModal = ({
  show,
  title,
  message,
  confirmText,
  cancelText,
  confirmVariant = 'primary',
  onConfirm,
  onClose
}) => {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!show) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, onClose]);

  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  if (!show) return null;

  const host = getPortalContainer();
  if (!host) return null;

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm?.();
    } finally {
      setBusy(false);
      onClose?.();
    }
  };

  return createPortal(
    <div
      className="tp-modal-backdrop tp-blur-backdrop tp-modal-backdrop--enter tp-modal-portal-layer"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="tp-modal-card tp-modal-card--enter p-4 tp-max-w-modal-md w-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="fw-semibold">{title ?? t('ui.confirm.areYouSure')}</div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-lg"
            onClick={onClose}
            aria-label={t('ui.button.close')}
          >
            ✕
          </button>
        </div>
        <p className="text-muted mb-4">{message ?? t('ui.confirm.areYouSure')}</p>
        <div className="d-flex gap-2 justify-content-end">
          <Button variant="outline-secondary" onClick={onClose} className="px-4">
            {cancelText ?? t('ui.button.cancel')}
          </Button>
          <Button variant={confirmVariant} onClick={handleConfirm} disabled={busy} className="px-4">
            {busy ? t('common.loading') : confirmText ?? t('ui.button.confirm')}
          </Button>
        </div>
      </div>
    </div>,
    host
  );
};

export default ConfirmActionModal;
