import React, { useMemo } from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';

/**
 * @param {{ steps: Array<{ id: string, label?: string, labelKey?: string }>, currentId: string, className?: string }} props
 */
const FlowTimeline = ({ steps, currentId, className = '' }) => {
  const { t } = useLanguage();
  const currentIndex = useMemo(
    () => Math.max(0, steps.findIndex((s) => s.id === currentId)),
    [steps, currentId]
  );

  return (
    <ol className={`tp-flow-timeline list-unstyled mb-0 ${className}`.trim()} aria-label={t('flow.timelineAria')}>
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const label = step.labelKey ? t(step.labelKey) : step.label || step.id;
        return (
          <li
            key={step.id}
            className={`tp-flow-timeline__step ${done ? 'tp-flow-timeline__step--done' : ''} ${
              active ? 'tp-flow-timeline__step--active' : ''
            }`}
          >
            <span className="tp-flow-timeline__node" aria-hidden />
            <span className="tp-flow-timeline__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
};

export const LOAD_BID_STEPS = [
  { id: 'posted', labelKey: 'flow.posted' },
  { id: 'bid_received', labelKey: 'flow.bidReceived' },
  { id: 'accepted', labelKey: 'flow.accepted' },
  { id: 'active', labelKey: 'flow.active' },
  { id: 'in_transit', labelKey: 'flow.inTransit' },
  { id: 'delivered', labelKey: 'flow.delivered' },
  { id: 'completed', labelKey: 'flow.completed' }
];

export const SPACE_STEPS = [
  { id: 'space_listed', labelKey: 'flow.spaceListed' },
  { id: 'request_sent', labelKey: 'flow.requestSent' },
  { id: 'active', labelKey: 'flow.active' },
  { id: 'in_transit', labelKey: 'flow.inTransit' },
  { id: 'completed', labelKey: 'flow.completed' }
];

export default FlowTimeline;
