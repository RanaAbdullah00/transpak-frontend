import React, { useCallback, useEffect, useState } from 'react';
import Card from '../ui/Card.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { emitRealtimeRefresh } from '../../utils/spaceFlow.js';
import { emitReviewPrompt } from '../../utils/reviewPrompt.js';
import SpaceRequestLifecycle from './SpaceRequestLifecycle.jsx';

const SpaceSentRequestsPanel = () => {
  const { t } = useLanguage();
  const { request } = useApi();
  const [rows, setRows] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/carrier-space/requests/sent' });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    }
  }, [request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const h = () => refresh();
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

  if (!rows.length) return null;

  return (
    <Card className="p-3 mb-3">
      <h6 className="mb-3">{t('loadsHub.mySpaceRequests')}</h6>
      <div className="d-flex flex-column gap-3">
        {rows.map((r) => (
          <SpaceRequestLifecycle
            key={r.id}
            row={r}
            showCarrierActions={false}
            onInTransit={(id) => transition(id, 'in-transit')}
            onComplete={(id) => transition(id, 'complete')}
          />
        ))}
      </div>
    </Card>
  );
};

export default SpaceSentRequestsPanel;
