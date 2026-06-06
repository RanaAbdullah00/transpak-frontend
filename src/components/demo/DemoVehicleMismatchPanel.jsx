import React from 'react';
import Button from '../ui/Button.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

/**
 * Demo-only UI when VEHICLE_TYPE_MISMATCH blocks carrier bid — does not appear in production.
 */
const DemoVehicleMismatchPanel = ({ loadLabel = '', onProceed, onDismiss, busy = false }) => {
  const { t } = useLanguage();

  return (
    <div
      className="alert alert-warning border-warning-subtle d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-3"
      role="status"
    >
      <div className="small">
        <strong>{t('demo.vehicleMismatchTitle')}</strong>
        <span className="d-block text-muted mt-1">
          {loadLabel
            ? t('demo.vehicleMismatchBodyWithLoad', { load: loadLabel })
            : t('demo.vehicleMismatchBody')}
        </span>
      </div>
      <div className="d-flex gap-2 flex-shrink-0">
        {onDismiss ? (
          <Button variant="outline-secondary" size="sm" onClick={onDismiss} disabled={busy}>
            {t('common.cancel')}
          </Button>
        ) : null}
        <Button variant="warning" size="sm" onClick={onProceed} disabled={busy}>
          {t('demo.proceedDemoPreview')}
        </Button>
      </div>
    </div>
  );
};

export default DemoVehicleMismatchPanel;
