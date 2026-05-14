/**
 * Unified overlay mounting: all modals, sheets, and portaled toasts target #tp-portal-root
 * (fallback: document.body) so React does not fight with #root sibling ordering.
 *
 * Z-index contract (low → high): base app → layout/sidebar → page → sheets → modals → loading → toasts
 */
export const TP_Z = {
  BASE: 0,
  STICKY_NAV: 1020,
  SIDEBAR: 1030,
  DRAWER: 1500,
  SHEET: 10040,
  MODAL: 10050,
  LOADING: 10060,
  TOAST: 11000
};

export function getPortalContainer() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('tp-portal-root') || document.body;
}
