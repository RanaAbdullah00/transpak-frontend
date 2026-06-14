import React, { useCallback, useContext, useEffect, useState } from 'react';
import Card from '../ui/Card.jsx';
import { AppContext } from '../../context/AppContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { triggerAcceptActivationSync, emitRealtimeRefresh, isOpsRequestSentRow } from '../../utils/spaceFlow.js';
import { commitOptimisticSpaceAccept } from '../../utils/contractActivationLayer.js';
import { emitReviewPrompt } from '../../utils/reviewPrompt.js';
import SpaceRequestLifecycle from './SpaceRequestLifecycle.jsx';
import { isCapacityFlowPending } from '../../utils/flowSession.js';

const SpaceRequestsPanel = ({ embedded = false, onRowCount, listingIdFilter = null }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { request } = useApi();
  const { getSocket } = useContext(AppContext) || {};
  const [rows, setRows] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/carrier-space/requests/incoming' });
      setRows((Array.isArray(data) ? data : []).filter(isOpsRequestSentRow));
    } catch {
      setRows([]);
    }
  }, [request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visibleRows = React.useMemo(() => {
    if (!listingIdFilter) return rows;
    const target = String(listingIdFilter);
    return rows.filter((r) => String(r?.listingId || '') === target);
  }, [rows, listingIdFilter]);

  useEffect(() => {
    onRowCount?.(visibleRows.length);
  }, [visibleRows.length, onRowCount]);

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
      if (scope && scope !== 'all' && scope !== 'space' && scope !== 'loads') return;
      refresh();
    };
    const onContractActivated = () => refresh();
    const onShipmentsRefresh = () => refresh();
    window.addEventListener('tp:realtime-refresh', h);
    window.addEventListener('tp:contract-activated', onContractActivated);
    window.addEventListener('tp:shipments-refresh', onShipmentsRefresh);
    return () => {
      window.removeEventListener('tp:realtime-refresh', h);
      window.removeEventListener('tp:contract-activated', onContractActivated);
      window.removeEventListener('tp:shipments-refresh', onShipmentsRefresh);
    };
  }, [refresh]);

  const respond = async (id, action) => {
    try {
      const res = await request({ method: 'PUT', url: `/carrier-space/requests/${id}/${action}` });
      notifySuccess(action === 'accept' ? t('loadsHub.requestAccepted') : t('loadsHub.requestRejected'));
      if (action === 'accept') {
        commitOptimisticSpaceAccept(id, res, {
          userId: user?.id,
          role: 'carrier',
          carrierId: user?.id
        });
        await triggerAcceptActivationSync(res, {
          userId: user?.id,
          role: 'carrier'
        });
      } else {
        emitRealtimeRefresh('space');
      }
      refresh();
    } catch (err) {
      notifyError(formatUserError(err, t));
    }
  };

  const transition = async (id, action) => {
    const row = rows.find((r) => r.id === id);
    try {
      await request({ method: 'PUT', url: `/carrier-space/requests/${id}/${action}` });
      notifySuccess(t('loadsHub.spaceStatusUpdated'));
      emitRealtimeRefresh('space');
      if (action === 'complete' && row?.shipperId) {
        emitReviewPrompt({
          kind: 'space',
          spaceRequestId: id,
          toUserId: row.shipperId,
          toUserName: row.shipperName,
          toUserAvatar: row.shipperAvatar,
          toUserRole: 'shipper',
          label: `${row.origin} → ${row.destination}`
        });
      }
      refresh();
    } catch (err) {
      notifyError(formatUserError(err, t));
    }
  };

  const pendingCount = visibleRows.filter((r) => isCapacityFlowPending(r)).length;

  return (
    <Card className={`p-3 mb-3 ${pendingCount > 0 ? 'tp-space-requests-panel--priority border-warning' : ''}`}>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h6 className="mb-0">{t('loadsHub.incomingRequests')}</h6>
        {pendingCount > 0 ? (
          <span className="badge text-bg-warning">{t('loadsHub.pendingRequests', { count: pendingCount })}</span>
        ) : null}
      </div>
      {!visibleRows.length ? (
        <p className="small text-muted mb-0">{t('loadsHub.noIncomingRequests')}</p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {visibleRows.map((r) => (
            <SpaceRequestLifecycle
              key={r.id}
              row={r}
              showCarrierActions
              priority={isCapacityFlowPending(r)}
              onAccept={(id) => respond(id, 'accept')}
              onReject={(id) => respond(id, 'reject')}
              onInTransit={(id) => transition(id, 'in-transit')}
              onComplete={(id) => transition(id, 'complete')}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

export default SpaceRequestsPanel;
