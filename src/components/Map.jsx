import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/map.css';
import { createMarkerIcon, fixLeafletIcons, MAP_MARKER_COLORS } from '../utils/leafletIcons.js';
import { normalizeCoordList, toLatLngPair } from '../utils/mapCoords.js';
import { useSmoothCoords } from '../hooks/useSmoothCoords.js';
import { useLanguage } from '../hooks/useLanguage.js';
fixLeafletIcons();

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    if (points.length === 1) {
      map.setView(points[0], 10);
      return;
    }
    map.fitBounds(points, { padding: [36, 36], maxZoom: 12 });
  }, [map, points]);
  return null;
}

function MapResizeObserver() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer()?.parentElement;
    if (!container) return undefined;

    const invalidate = () => {
      window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false, pan: false });
        if (typeof map.redraw === 'function') map.redraw();
      });
    };

    const ro = new ResizeObserver(invalidate);
    ro.observe(container);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') invalidate();
    };
    document.addEventListener('visibilitychange', onVisibility);

    invalidate();
    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [map]);
  return null;
}

function MapForceInvalidate({ active = false, invalidateKey = 0 }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return undefined;
    const container = map.getContainer()?.parentElement;
    const run = () => {
      map.invalidateSize({ animate: false, pan: false });
      if (typeof map.redraw === 'function') map.redraw();
      window.dispatchEvent(new Event('resize'));
    };
    requestAnimationFrame(run);
    const t1 = window.setTimeout(run, 0);
    const t2 = window.setTimeout(run, 120);
    if (container) {
      try {
        container.dispatchEvent(new Event('resize'));
      } catch {
        /* ignore */
      }
    }
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [map, active, invalidateKey]);
  return null;
}

/**
 * OpenStreetMap map — pickup, delivery, optional route, live driver marker.
 * @param {object} props
 * @param {[number,number]|{lat:number,lng:number}} [props.pickup]
 * @param {[number,number]|{lat:number,lng:number}} [props.delivery]
 * @param {[number,number]|{lat:number,lng:number}} [props.driver]
 * @param {Array} [props.route] polyline points
 * @param {boolean} [props.liveDriver] reserved — geolocation is handled by useShipmentTracking
 * @param {string} [props.className]
 * @param {string|number} [props.height]
 * @param {string} [props.pickupLabel]
 * @param {string} [props.deliveryLabel]
 * @param {string} [props.driverLabel]
 * @param {boolean} [props.loading]
 * @param {string} [props.errorMessage]
 */
const Map = ({
  pickup,
  delivery,
  driver,
  route,
  className = '',
  height = 'min(420px, 50vh)',
  pickupLabel = 'Pickup',
  deliveryLabel = 'Delivery',
  driverLabel = 'Driver',
  loading = false,
  errorMessage = '',
  forceInvalidate = false,
  invalidateKey = 0
}) => {
  const { t } = useLanguage();
  const pickupPos = toLatLngPair(pickup);
  const deliveryPos = toLatLngPair(delivery);
  const driverTarget = toLatLngPair(driver);
  const driverPos = useSmoothCoords(driverTarget, { durationMs: 800 });

  const routeCoords = useMemo(() => {
    const fromProp = normalizeCoordList(route);
    if (fromProp.length >= 2) return fromProp;
    if (pickupPos && deliveryPos) return [pickupPos, deliveryPos];
    if (pickupPos || deliveryPos) return [pickupPos || deliveryPos].filter(Boolean);
    return [];
  }, [route, pickupPos, deliveryPos]);

  const showRoute = routeCoords.length >= 2;
  const effectivePickup = pickupPos || (showRoute ? routeCoords[0] : null);
  const effectiveDelivery =
    deliveryPos || (showRoute ? routeCoords[routeCoords.length - 1] : null);

  const allPoints = useMemo(() => {
    const pts = [];
    if (effectivePickup) pts.push(effectivePickup);
    if (effectiveDelivery && effectiveDelivery !== effectivePickup) pts.push(effectiveDelivery);
    if (driverPos) pts.push(driverPos);
    if (pts.length) return pts;
    if (routeCoords.length) return routeCoords;
    return [[30.3753, 69.3451]];
  }, [effectivePickup, effectiveDelivery, driverPos, routeCoords]);

  const center = allPoints[Math.floor(allPoints.length / 2)] || [30.3753, 69.3451];
  const zoom = allPoints.length > 1 ? 6 : allPoints.length === 1 ? 8 : 5;
  const hasMapData = Boolean(effectivePickup || effectiveDelivery || driverPos || routeCoords.length);

  const pickupIcon = useMemo(() => createMarkerIcon(MAP_MARKER_COLORS.pickup, 'P'), []);
  const deliveryIcon = useMemo(() => createMarkerIcon(MAP_MARKER_COLORS.delivery, 'D'), []);
  const driverIcon = useMemo(() => createMarkerIcon(MAP_MARKER_COLORS.driver, '•'), []);

  return (
    <div className={`tp-map-root ${className}`.trim()} style={{ height }}>
      {loading ? (
        <div className="tp-map-overlay tp-map-overlay--loading" role="status" aria-live="polite">
          {t('map.loading')}
        </div>
      ) : null}
      {!loading && errorMessage ? (
        <div className="tp-map-overlay tp-map-overlay--warn" role="status">
          {errorMessage}
        </div>
      ) : null}
      {!hasMapData && !loading ? (
        <div className="tp-map-empty" role="status">
          {t('pages.tracking.noCoords')}
        </div>
      ) : null}
      <MapContainer
        center={center}
        zoom={zoom}
        className="rounded-3 overflow-hidden"
        style={{ height: '100%', minHeight: 220 }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />
        <MapResizeObserver />
        <MapForceInvalidate active={forceInvalidate} invalidateKey={invalidateKey} />
        {showRoute ? (
          <Polyline positions={routeCoords} color="#16a34a" weight={4} opacity={0.85} />
        ) : null}
        {effectivePickup ? (
          <Marker position={effectivePickup} icon={pickupIcon}>
            <Popup>{pickupLabel}</Popup>
          </Marker>
        ) : null}
        {effectiveDelivery && effectiveDelivery !== effectivePickup ? (
          <Marker position={effectiveDelivery} icon={deliveryIcon}>
            <Popup>{deliveryLabel}</Popup>
          </Marker>
        ) : null}
        {driverPos ? (
          <Marker position={driverPos} icon={driverIcon}>
            <Popup>{driverLabel}</Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
};

export default Map;
