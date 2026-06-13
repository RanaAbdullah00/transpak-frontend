export const ADMIN_SMART_LOGIN_EMAIL = String(
  import.meta.env.VITE_ADMIN_SMART_LOGIN_EMAIL || 'mrrajpoot.327@gmail.com'
)
  .trim()
  .toLowerCase();

export function isAdminSmartLoginEmail(email) {
  const norm = String(email || '')
    .trim()
    .toLowerCase();
  return norm.length > 0 && norm === ADMIN_SMART_LOGIN_EMAIL;
}
