export function dashboardPathForRole(role) {
  if (!role || typeof role !== 'string') return '/';
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'carrier') return '/dashboard/carrier';
  if (role === 'shipper') return '/dashboard/shipper';
  return '/';
}
