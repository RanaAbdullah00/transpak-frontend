import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import TrackingMap from '../../components/shipment/TrackingMap.jsx';
import RouteInfo from '../../components/shipment/RouteInfo.jsx';
import ShipmentCard from '../../components/shipment/ShipmentCard.jsx';
import StatusTimeline from '../../components/shipment/StatusTimeline.jsx';
import ShipmentProgressBox from '../../components/shipment/ShipmentProgressBox.jsx';
import api from '../../services/api.js';
import { normalizeTracking } from '../../adapters/normalize.js';
import { AppContext } from '../../context/AppContext.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { formatUserError } from '../../utils/userErrors.js';

function mergeTrackingHistory(prev, incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) return Array.isArray(prev) ? prev : [];
  const keyOf = (ev) =>
    `${String(ev?.time ?? '')}|${String(ev?.event ?? ev?.label ?? '')}|${String(ev?.location ?? ev?.note ?? '')}`;
  const map = new Map();
  for (const ev of [...incoming, ...(Array.isArray(prev) ? prev : [])]) {
    const k = keyOf(ev);
    if (!map.has(k)) map.set(k, ev);
  }
  return Array.from(map.values());
}

const ShipmentTracking = () => {
  const { trackId } = useParams();
  const id = trackId?.trim() || '';
  const { registerTrackingHandler } = useContext(AppContext) || {};
  const { t } = useLanguage();

  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setPayload(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/shipments/track/${encodeURIComponent(id)}`);
      const raw = res?.data;
      setPayload(normalizeTracking(raw) || null);
    } catch (e) {
      setError(formatUserError(e, t, { fallback: t('pages.tracking.loadFailed') }));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!registerTrackingHandler) return undefined;
    return registerTrackingHandler((p) => {
      if (!p || (p.refKey != null && String(p.refKey) !== String(id))) return;
      setPayload((prev) => {
        const prevCoords = prev?.liveTrackingMap?.coordinates;
        const incCoords = p.liveTrackingMap?.coordinates;
        const mergedCoords =
          Array.isArray(incCoords) && incCoords.length > 0
            ? incCoords
            : Array.isArray(prevCoords) && prevCoords.length > 0
              ? prevCoords
              : incCoords || prevCoords || [];

        const mergedHist =
          Array.isArray(p.history) && p.history.length > 0
            ? mergeTrackingHistory(prev?.history, p.history)
            : prev?.history || [];

        const merged = {
          tracking: { ...(prev?.tracking || {}), ...(p.tracking || {}) },
          history: mergedHist,
          liveTrackingMap: {
            ...(prev?.liveTrackingMap || {}),
            ...(p.liveTrackingMap || {}),
            coordinates: mergedCoords
          }
        };
        return normalizeTracking(merged);
      });
    });
  }, [registerTrackingHandler, id]);

  const tracking = payload?.tracking;
  const coords = useMemo(() => {
    const raw = payload?.liveTrackingMap?.coordinates || [];
    return raw.filter(
      (c) =>
        Array.isArray(c) &&
        c.length >= 2 &&
        Number.isFinite(Number(c[0])) &&
        Number.isFinite(Number(c[1]))
    ).map((c) => [Number(c[0]), Number(c[1])]);
  }, [payload?.liveTrackingMap?.coordinates]);
  const currentLocation = useMemo(() => {
    const direct = tracking?.currentLocation;
    if (Array.isArray(direct) && direct.length >= 2) return [Number(direct[0]), Number(direct[1])];
    const loc = tracking?.location;
    if (
      Array.isArray(loc) &&
      loc.length >= 2 &&
      Number.isFinite(Number(loc[0])) &&
      Number.isFinite(Number(loc[1]))
    ) {
      return [Number(loc[0]), Number(loc[1])];
    }
    return null;
  }, [tracking?.currentLocation, tracking?.location]);

  const shipment = useMemo(
    () => ({
      code: `#${id}`,
      origin: t('common.emDash'),
      destination: t('common.emDash'),
      status: tracking?.status || 'posted',
      driverName: t('common.emDash'),
      vehicleReg: t('common.emDash'),
      eta: tracking?.eta || t('common.emDash'),
      lastUpdate: payload?.history?.[0]?.time || t('common.emDash')
    }),
    [id, tracking, payload?.history, t]
  );

  const timelineEvents = useMemo(() => {
    const h = payload?.history || [];
    return h.map((ev) => ({
      label: ev.event || ev.label || t('pages.tracking.timelineUpdate'),
      time: ev.time || '',
      done: true,
      note: ev.location
    }));
  }, [payload?.history, t]);

  const checkpoints = useMemo(() => {
    if (coords.length >= 2)
      return coords.map((_, i) => t('pages.tracking.mapPoint', { n: String(i + 1) }));
    if (coords.length === 1) return [t('pages.tracking.lastReportedPosition')];
    return [];
  }, [coords, t]);

  const trackingDataForMap = useMemo(
    () => ({
      tracking: {
        status: tracking?.status,
        eta: tracking?.eta,
        currentLocation,
        locationUnavailable: tracking?.locationUnavailable
      },
      liveTrackingMap: payload?.liveTrackingMap || { coordinates: coords }
    }),
    [tracking, currentLocation, payload?.liveTrackingMap, coords]
  );

  if (!id) {
    return (
      <div className="container py-3">
        <h5 className="mb-3 text-body">{t('pages.tracking.title')}</h5>
        <p className="small tp-support-muted mb-0">{t('pages.tracking.noIdHint')}</p>
      </div>
    );
  }

  if (loading && !payload) {
    return (
      <div className="container py-3">
        <h5 className="mb-3">{t('pages.tracking.title')}</h5>
        <p className="small text-muted">{t('pages.tracking.loading')}</p>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="container py-3">
        <h5 className="mb-3">{t('pages.tracking.title')}</h5>
        <p className="text-danger small">{error}</p>
      </div>
    );
  }

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('pages.tracking.title')}</h5>
      {error ? <p className="text-warning small mb-2">{error}</p> : null}
      <ShipmentCard shipment={shipment} />
      <div className="tp-tracking-progress mb-3">
        <ShipmentProgressBox status={shipment.status} eta={shipment.eta} />
      </div>
      <div className="tp-tracking-map mb-3 overflow-hidden">
        <TrackingMap trackingData={trackingDataForMap} currentLocation={currentLocation} />
      </div>
      <StatusTimeline currentStatus={shipment.status} events={timelineEvents} />
      <RouteInfo distance={null} duration={null} checkpoints={checkpoints} />
    </div>
  );
};

export default ShipmentTracking;
