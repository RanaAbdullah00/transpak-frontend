import React from 'react';
import Card from '../ui/Card.jsx';
import StatusBadge from './StatusBadge.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import TranslatedText from '../ui/TranslatedText.jsx';
import { timelineDotClassForStatus } from '../../utils/statusColorTokens.js';

function splitEventTime(raw) {
  const text = String(raw || '').trim();
  if (!text) return { date: '', time: '' };
  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) {
    return {
      date: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    };
  }
  const parts = text.split(/\s+/);
  if (parts.length >= 2) {
    return { date: parts.slice(0, -1).join(' '), time: parts[parts.length - 1] };
  }
  return { date: text, time: '' };
}

const StatusTimeline = ({ currentStatus, uiState = null, events = [] }) => {
  const { t } = useLanguage();
  const safeEvents = Array.isArray(events) ? events : [];

  return (
    <Card>
      <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
        <h6 className="mb-0 text-body fw-semibold">{t('pages.tracking.statusTimelineTitle')}</h6>
        <StatusBadge uiState={uiState} status={currentStatus} />
      </div>
      <ul className="list-unstyled small mb-0 tp-timeline">
        {safeEvents.map((e, idx) => {
          const { date, time } = splitEventTime(e?.time);
          const dotClass = timelineDotClassForStatus(e?.status || currentStatus);
          return (
            <li key={`${e?.label ?? 'step'}-${idx}`} className="tp-timeline-item">
              <div className={`tp-timeline-dot ${e.done ? 'done' : ''} ${dotClass}`} />
              <div className="tp-timeline-content">
                <div className="fw-semibold text-body">
                  <TranslatedText text={e?.label ?? ''} as="span" />
                </div>
                <div className="tp-timeline-meta d-flex flex-wrap gap-2">
                  {date ? <span>{date}</span> : null}
                  {time ? <span>{time}</span> : null}
                </div>
                {e?.note ? (
                  <div className="tp-timeline-meta">
                    <TranslatedText text={e.note} as="span" />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

export default StatusTimeline;
