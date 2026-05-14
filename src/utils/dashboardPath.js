export function dashboardPathForRole(role) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "carrier") return "/dashboard/carrier";
  return "/dashboard/shipper";
}
