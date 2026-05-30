import { useContext } from 'react';
import { AppContext } from '../context/AppContext.jsx';

/** True when realtime socket is connected — polling fallbacks must stay off. */
export function useSocketConnected() {
  const ctx = useContext(AppContext);
  return ctx?.socketStatus === 'connected';
}

/** True when HTTP polling is allowed (socket disconnected or unavailable). */
export function usePollingAllowed() {
  const ctx = useContext(AppContext);
  if (!ctx) return true;
  return ctx.socketStatus !== 'connected';
}
