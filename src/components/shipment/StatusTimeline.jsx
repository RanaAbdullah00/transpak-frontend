import React from 'react';
import Card from '../ui/Card.jsx';
import StatusBadge from './StatusBadge.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const StatusTimeline = ({ currentStatus, events }) => {
  const { t } = useLanguage();

  return (
    <Card>
      <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
        <h6 className="mb-0 text-body fw-semibold">{t('pages.tracking.statusTimelineTitle')}</h6>
        <StatusBadge status={currentStatus} />
      </div>
      <ul className="list-unstyled small mb-0 tp-timeline">
        {events.map((e, idx) => (
          <li key={`${e.label}-${idx}`} className="tp-timeline-item">
            <div className={`tp-timeline-dot ${e.done ? 'done' : ''}`} />
            <div className="tp-timeline-content">
              <div className="fw-semibold text-body">{e.label}</div>
              <div className="tp-timeline-meta">{e.time}</div>
              {e.note ? <div className="tp-timeline-meta">{e.note}</div> : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default StatusTimeline;
