import React, { useCallback, useContext, useEffect, useState } from 'react';
import Card from '../ui/Card.jsx';
import { AppContext } from '../../context/AppContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { emitRealtimeRefresh } from '../../utils/spaceFlow.js';
import { emitReviewPrompt } from '../../utils/reviewPrompt.js';
import SpaceRequestLifecycle from './SpaceRequestLifecycle.jsx';
import { isCapacityFlowActive } from '../../utils/flowSession.js';
import { SkeletonCard } from '../ui/Skeleton.jsx';

const SpaceSentRequestsPanel = ({ embedded = false }) => {
  const { t } = useLanguage();
  const { request } = useApi();
  const { getSocket } = useContext(AppContext) || {};
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/carrier-space/requests/sent' });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoaded(true);
    }
  }, [request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const socket = getSocket?.();
    if (!socket || !rows.length) return undefined;
    rows.forEach((r) => {
      if (r?.id) socket.emit('space:join', { requestId: r.id });
    });
    const onConnect = () => {
      rows.forEach((r) => {
        if (r?.id) socket.emit('space:join', { requestId: r.id });
      });
    };
    socket.on('connect', onConnect);
    return () => socket.off('connect', onConnect);
  }, [getSocket, rows]);

  useEffect(() => {
    const h = (e) => {
      const scope = e?.detail?.scope;
      if (
        scope &&
        scope !== 'all' &&
        scope !== 'space' &&
        scope !== 'loads' &&
        scope !== 'shipments'
      ) {
        return;
      }
      refresh();
    };
    window.addEventListener('tp:realtime-refresh', h);
    return () => window.removeEventListener('tp:realtime-refresh', h);
  }, [refresh]);

  const transition = async (id, action) => {
    const row = rows.find((r) => r.id === id);
    try {
      await request({ method: 'PUT', url: `/carrier-space/requests/${id}/${action}` });
      notifySuccess(t('loadsHub.spaceStatusUpdated'));
      emitRealtimeRefresh('space');
      if (action === 'complete' && row?.carrierId) {
        emitReviewPrompt({
          kind: 'space',
          spaceRequestId: id,
          toUserId: row.carrierId,
          toUserName: row.carrierName,
          label: `${row.origin} → ${row.destination}`
        });
      }
      refresh();
    } catch (err) {
      notifyError(formatUserError(err, t));
    }
  };

  if (!loaded) {
    return (
      <Card className={`p-3 ${embedded ? 'mb-0' : 'mb-3'}`}>
        <SkeletonCard rows={2} />
      </Card>
    );
  }

  return (
    <Card className={`p-3 ${embedded ? 'mb-0' : 'mb-3'}`}>
      {!embedded ? <h6 className="mb-3">{t('loadsHub.mySpaceRequests')}</h6> : null}
      {!rows.length ? (
        <p className="small text-muted mb-0">{t('loadsHub.noSpaceRequestsYet')}</p>
      ) : (
      <div className="d-flex flex-column gap-3">
        {rows.map((r) => (
          <SpaceRequestLifecycle
            key={r.id}
            row={r}
            showCarrierActions={false}
            priority={isCapacityFlowActive(r)}
            onInTransit={(id) => transition(id, 'in-transit')}
            onComplete={(id) => transition(id, 'complete')}
          />
        ))}
      </div>
      )}
    </Card>
  );
};

export default SpaceSentRequestsPanel;
