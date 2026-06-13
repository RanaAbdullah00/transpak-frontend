import React from 'react';
import Button from '../ui/Button.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const DEFAULT_SLOT = { start: '08:00', end: '12:00' };

export function normalizeSlotList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ({
      start: String(s?.start || '').trim(),
      end: String(s?.end || '').trim()
    }))
    .filter((s) => s.start && s.end);
}

export function formatSlotsSummary(slots, t) {
  const list = normalizeSlotList(slots);
  if (!list.length) return '';
  return list.map((s) => `${s.start}–${s.end}`).join(', ');
}

const AvailabilitySlotPicker = ({ slots = [], onChange, maxSlots = 6 }) => {
  const { t } = useLanguage();
  const rows = Array.isArray(slots) && slots.length ? slots : [{ ...DEFAULT_SLOT }];

  const updateRow = (index, field, value) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    onChange(next);
  };

  const addRow = () => {
    if (rows.length >= maxSlots) return;
    onChange([...rows, { ...DEFAULT_SLOT }]);
  };

  const removeRow = (index) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length ? next : [{ ...DEFAULT_SLOT }]);
  };

  return (
    <div className="mb-2">
      <label className="form-label small fw-semibold mb-1">{t('loadsHub.availabilitySlots')}</label>
      {rows.map((row, index) => (
        <div key={index} className="d-flex gap-2 align-items-center mb-2">
          <input
            type="time"
            className="form-control form-control-sm rounded-3"
            value={row.start}
            onChange={(e) => updateRow(index, 'start', e.target.value)}
          />
          <span className="small text-muted">–</span>
          <input
            type="time"
            className="form-control form-control-sm rounded-3"
            value={row.end}
            onChange={(e) => updateRow(index, 'end', e.target.value)}
          />
          {rows.length > 1 ? (
            <Button variant="outline-secondary" size="sm" type="button" onClick={() => removeRow(index)}>
              ×
            </Button>
          ) : null}
        </div>
      ))}
      {rows.length < maxSlots ? (
        <Button variant="outline-secondary" size="sm" type="button" onClick={addRow}>
          + {t('loadsHub.addTimeSlot')}
        </Button>
      ) : null}
    </div>
  );
};

export default AvailabilitySlotPicker;
