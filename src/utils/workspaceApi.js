/**
 * List API query helpers — optional ?viewAs= hint from UI workspace (activeRole).
 * Server enforces viewAs ∈ roles[] (403 FORBIDDEN_VIEW_AS if invalid).
 * See transpak-backend/docs/RBAC.md
 */

export function viewAsQuery(user) {
  const v = user?.activeRole;
  if (v === 'shipper' || v === 'carrier') return { viewAs: v };
  return {};
}
