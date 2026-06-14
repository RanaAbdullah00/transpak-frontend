import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';
import { DEFAULT_VISIBILITY_HOURS, DEFAULT_VISIBILITY_MINUTES } from '../../utils/capacityVisibility.js';

const CapacityVisibilityDuration = ({ hours, minutes, onChange, disabled = false }) => {
  const { t } = useLanguage();
  return (
    <div className="mb-3">
      <label className="form-label small fw-semibold mb-1">{t('loadsHub.visibilityDuration')}</label>
      <div className="row g-2">
        <div className="col-6">
          <label className="form-label small text-muted mb-1">{t('loadsHub.visibilityHours')}</label>
          <input
            type="number"
            min="0"
            max="72"
            className="form-control form-control-sm rounded-3"
            value={hours}
            disabled={disabled}
            onChange={(e) => onChange({ hours: e.target.value, minutes })}
          />
        </div>
        <div className="col-6">
          <label className="form-label small text-muted mb-1">{t('loadsHub.visibilityMinutes')}</label>
          <input
            type="number"
            min="0"
            max="59"
            className="form-control form-control-sm rounded-3"
            value={minutes}
            disabled={disabled}
            onChange={(e) => onChange({ hours, minutes: e.target.value })}
          />
        </div>
      </div>
      <p className="small text-muted mb-0 mt-1">{t('loadsHub.visibilityDurationHint')}</p>
    </div>
  );
};

export { DEFAULT_VISIBILITY_HOURS, DEFAULT_VISIBILITY_MINUTES };
export default CapacityVisibilityDuration;
