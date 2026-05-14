import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Card from '../ui/Card.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

function isLatLngPair(v) {
  return (
    Array.isArray(v) &&
    v.length >= 2 &&
    Number.isFinite(Number(v[0])) &&
    Number.isFinite(Number(v[1]))
  );
}

function normalizeCoordList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(isLatLngPair)
    .map((c) => [Number(c[0]), Number(c[1])]);
}

function samePair(a, b) {
  if (!isLatLngPair(a) || !isLatLngPair(b)) return false;
  return Number(a[0]) === Number(b[0]) && Number(a[1]) === Number(b[1]);
}

const TrackingMap = ({ route = [], currentLocation, trackingData }) => {
  const { t, isUrdu } = useLanguage();
  const coords = useMemo(() => {
    const fromData = normalizeCoordList(trackingData?.liveTrackingMap?.coordinates);
    if (fromData.length > 0) return fromData;
    return normalizeCoordList(route);
  }, [trackingData?.liveTrackingMap?.coordinates, route]);

  const rawCurrent = trackingData?.tracking?.currentLocation ?? currentLocation;
  const currentCoords = isLatLngPair(rawCurrent) ? rawCurrent.map(Number) : null;

  const center = useMemo(() => {
    if (currentCoords) return currentCoords;
    if (coords.length >= 1) return coords[Math.floor(coords.length / 2)];
    return [24, 68];
  }, [currentCoords, coords]);

  const showPolyline = coords.length >= 2;
  const routeEnd = coords.length >= 1 ? coords[coords.length - 1] : null;
  const showCurrentMarker =
    currentCoords &&
    !(showPolyline && samePair(currentCoords, coords[0])) &&
    !(showPolyline && routeEnd && samePair(currentCoords, routeEnd)) &&
    !(coords.length === 1 && !showPolyline && samePair(currentCoords, coords[0]));
  const locationUnavailable = Boolean(trackingData?.tracking?.locationUnavailable);
  const hasAnyPoint = Boolean(currentCoords || coords.length > 0);

  if (!hasAnyPoint) {
    return (
      <Card className={`tp-map-card h-100 ${isUrdu ? 'tp-rtl' : ''}`}>
        <h6 className="mb-2">{t('pages.trackingMap.title')}</h6>
        {locationUnavailable ? (
          <div className="alert alert-warning py-2 px-3 small mb-0" role="status">
            {t('pages.trackingMap.unavailable')}
          </div>
        ) : (
          <p className="small text-muted mb-0">{t('pages.trackingMap.noCoords')}</p>
        )}
      </Card>
    );
  }

  return (
    <Card className={`tp-map-card h-100 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h6 className="mb-2">{t('pages.trackingMap.title')}</h6>
      {locationUnavailable && coords.length > 0 && (
        <div className="alert alert-warning py-2 px-3 small mb-2 mb-md-3" role="status">
          {t('pages.trackingMap.partialWarning')}
        </div>
      )}
      <MapContainer
        center={center}
        zoom={coords.length > 1 ? 6 : 8}
        className="rounded-3 overflow-hidden"
        style={{ height: 'min(420px, 50vh)', minHeight: 220 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showPolyline ? <Polyline positions={coords} color="#16a34a" weight={4} /> : null}
        {showPolyline ? <Marker position={coords[0]} /> : null}
        {showPolyline && coords.length >= 2 && !samePair(coords[0], coords[coords.length - 1]) ? (
          <Marker position={coords[coords.length - 1]} />
        ) : null}
        {!showPolyline && coords.length === 1 ? <Marker position={coords[0]} /> : null}
        {showCurrentMarker ? <Marker position={currentCoords} /> : null}
      </MapContainer>
    </Card>
  );
};

export default TrackingMap;
