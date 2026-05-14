import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { getPortalContainer } from '../../utils/portalRoot.js';

const LogoutConfirmModal = ({ show, onClose }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

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

  const handleYes = () => {
    logout();
    onClose();
    navigate('/login', { replace: true });
  };

  return createPortal(
    <div
      className="tp-modal-backdrop tp-blur-backdrop tp-modal-backdrop--enter tp-modal-portal-layer"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="tp-modal-card tp-modal-card--enter p-4" onClick={(e) => e.stopPropagation()}>
        <h5 className="mb-3 fw-semibold">{t('common.logout')}</h5>
        <p className="text-muted mb-4">{t('common.logoutConfirm')}</p>
        <div className="d-flex gap-2 justify-content-end">
          <button type="button" className="btn btn-outline-secondary rounded-lg px-4" onClick={onClose}>
            {t('ui.button.no')}
          </button>
          <button type="button" className="btn btn-primary rounded-lg px-4" onClick={handleYes}>
            {t('ui.button.yes')}
          </button>
        </div>
      </div>
    </div>,
    host
  );
};

export default LogoutConfirmModal;
