import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

let fixed = false;

/** Fix webpack/vite broken default marker paths (Leaflet #4968). */
export function fixLeafletIcons() {
  if (fixed) return;
  fixed = true;
  // eslint-disable-next-line no-underscore-dangle
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
}

export function createMarkerIcon(color, label = '') {
  const html = label
    ? `<span class="tp-map-pin" style="background:${color}">${label}</span>`
    : `<span class="tp-map-pin" style="background:${color}"></span>`;
  return L.divIcon({
    className: 'tp-map-pin-wrap',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26]
  });
}

export const MAP_MARKER_COLORS = {
  pickup: '#16a34a',
  delivery: '#dc2626',
  driver: '#2563eb'
};
