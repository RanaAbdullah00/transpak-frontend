import React from 'react';

/**
 * Animated pill tabs — `tabs`: [{ id, label }], `active`, `onChange(id)`
 */
const SegmentTabs = ({ tabs, active, onChange, className = '' }) => (
  <div className={`tp-segment-tabs ${className}`.trim()} role="tablist">
    {tabs.map((tab) => {
      const isActive = tab.id === active;
      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          className={`tp-segment-tabs__btn ${isActive ? 'tp-segment-tabs__btn--active' : ''}`}
          onClick={() => onChange?.(tab.id)}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);

export default SegmentTabs;
