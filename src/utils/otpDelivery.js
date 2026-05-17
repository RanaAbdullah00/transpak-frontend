/**
 * Normalize OTP email delivery flags from API data (supports legacy + new field names).
 */

export function isEmailDelivered(data) {
  if (!data || typeof data !== 'object') return true;
  if (data.emailDelivered === true || data.emailSent === true || data.deliveryStatus === 'sent') {
    return true;
  }
  if (data.emailDelivered === false || data.emailSent === false || data.deliveryStatus === 'failed') {
    return false;
  }
  if (data.deliveryFailed === true && !data.devOtp) return false;
  return true;
}

export function getDeliveryHint(data, fallback = '') {
  const hint = data?.deliveryHint;
  return typeof hint === 'string' && hint.trim() ? hint.trim() : fallback;
}

export function pickDeliveryState(data) {
  const delivered = isEmailDelivered(data);
  return {
    emailDelivered: delivered,
    deliveryStatus: data?.deliveryStatus || (delivered ? 'sent' : 'failed'),
    deliveryHint: getDeliveryHint(data, ''),
    deliveryReason: data?.deliveryReason || null
  };
}
