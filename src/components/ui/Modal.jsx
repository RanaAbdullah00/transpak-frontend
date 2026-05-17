import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getPortalContainer } from '../../utils/portalRoot.js';

const Modal = ({ open, title, onClose, children, size = 'md', closeLabel = 'Close' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const sizeClass =
    size === 'lg' ? 'tp-max-w-modal-lg' : size === 'sm' ? 'tp-max-w-modal-sm' : 'tp-max-w-modal-md';
  const host = getPortalContainer();
  if (!host) return null;

  return createPortal(
    <div
      className="tp-modal-backdrop tp-blur-backdrop tp-modal-backdrop--enter tp-modal-portal-layer"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`tp-modal-card tp-modal-card--enter ${sizeClass} tp-max-h-modal overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex align-items-center justify-content-between mb-2 gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-lg tp-modal-close"
            onClick={onClose}
            aria-label={closeLabel}
          >
            ✕
          </button>
          <div className="fw-semibold flex-grow-1 text-center text-body">{title}</div>
          <div className="tp-modal-spacer" aria-hidden />
        </div>
        {children}
      </div>
    </div>,
    host
  );
};

export default Modal;
