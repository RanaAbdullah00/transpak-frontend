/** Role-aware notification filtering for navbar dropdown. */

export function notificationsForUser(notifications, user) {
  if (!Array.isArray(notifications) || !user) return [];
  const roles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.activeRole].filter(Boolean);
  const hasBoth = roles.includes('shipper') && roles.includes('carrier');
  const activeRole = user.activeRole;

  if (hasBoth) {
    return notifications.filter((n) => {
      if (!n.roleType) return true;
      return roles.includes(n.roleType);
    });
  }

  return notifications.filter((n) => {
    if (!n.roleType) return true;
    return n.roleType === activeRole;
  });
}
