/** Notifications are scoped on the server; client displays API rows as-is. */

export function notificationsForUser(notifications) {
  return Array.isArray(notifications) ? notifications : [];
}
