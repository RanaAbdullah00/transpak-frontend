import React from 'react';
import Card from '../ui/Card.jsx';
import StatusBadge from './StatusBadge.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import TranslatedText from '../ui/TranslatedText.jsx';

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
        {safeEvents.map((e, idx) => (
          <li key={`${e?.label ?? 'step'}-${idx}`} className="tp-timeline-item">
            <div className={`tp-timeline-dot ${e.done ? 'done' : ''}`} />
            <div className="tp-timeline-content">
              <div className="fw-semibold text-body">
                <TranslatedText text={e?.label ?? ''} as="span" />
              </div>
              <div className="tp-timeline-meta">{e?.time ?? ''}</div>
              {e?.note ? (
                <div className="tp-timeline-meta">
                  <TranslatedText text={e.note} as="span" />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default StatusTimeline;
