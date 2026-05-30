import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';

const SocketReconnectIndicator = ({ status = 'idle' }) => {
  const { t } = useLanguage();

  if (status === 'connected' || status === 'idle') return null;

  const isLost = status === 'lost';

  return (
    <div
      className={`tp-socket-status tp-socket-status--visible ${isLost ? 'tp-socket-status--lost' : ''}`}
      role="status"
      aria-live="polite"
    >
      {isLost ? t('realtime.connectionLost') : t('realtime.reconnecting')}
    </div>
  );
};

export default SocketReconnectIndicator;
