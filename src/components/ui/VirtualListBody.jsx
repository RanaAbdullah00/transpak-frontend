import React, { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_THRESHOLD = 50;

export function isVirtualListEnabled() {
  return import.meta.env.VITE_VIRTUAL_LISTS === '1';
}

/**
 * Optional lightweight virtual scroller — does not affect data fetching (ratingMap stays batch-level).
 */
const VirtualListBody = ({
  items = [],
  renderItem,
  getItemKey,
  itemHeight = 132,
  overscan = 4,
  virtualized,
  threshold = DEFAULT_THRESHOLD,
  className = '',
  style = {}
}) => {
  const enabled = virtualized ?? isVirtualListEnabled();
  const useVirtual = enabled && items.length >= threshold;
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);

  useEffect(() => {
    if (!useVirtual) return undefined;
    const el = containerRef.current;
    if (!el) return undefined;
    const update = () => setViewportHeight(el.clientHeight || 480);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [useVirtual, items.length]);

  const onScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  if (!useVirtual) {
    return (
      <div className={className} style={style}>
        {items.map((item, index) => renderItem(item, index))}
      </div>
    );
  }

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount =
    Math.ceil((viewportHeight || itemHeight) / itemHeight) + overscan * 2;
  const endIndex = Math.min(items.length, startIndex + visibleCount);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        overflowY: 'auto',
        maxHeight: style.maxHeight || '70vh'
      }}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {items.slice(startIndex, endIndex).map((item, offset) => {
          const index = startIndex + offset;
          const key = getItemKey ? getItemKey(item, index) : index;
          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                top: index * itemHeight,
                left: 0,
                right: 0,
                minHeight: itemHeight
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualListBody;
