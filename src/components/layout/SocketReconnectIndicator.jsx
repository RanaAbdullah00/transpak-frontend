import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';

const SocketReconnectIndicator = ({ socket }) => {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!socket) return undefined;
    const onDisconnect = () => setVisible(true);
    const onConnect = () => {
      setVisible(false);
    };
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    if (!socket.connected) setVisible(true);
    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
    };
  }, [socket]);

  if (!visible) return null;

  return (
    <div className="tp-socket-status tp-socket-status--visible" role="status" aria-live="polite">
      {t('realtime.reconnecting')}
    </div>
  );
};

export default SocketReconnectIndicator;
