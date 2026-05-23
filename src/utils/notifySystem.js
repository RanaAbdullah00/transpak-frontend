/**
 * Single global notification router — use everywhere instead of ad-hoc toast calls.
 */
import {
  notifySuccess,
  notifyError,
  notifyInfo,
  notifyWarning,
  notifyBidAccepted,
  notifyBidRejected,
  notifyContractStarted,
  notifyLoadPosted,
  notifyProfileUpdated
} from '../components/ui/ToastProvider.jsx';
import { unwrapErrorDetail } from './unwrapApi.js';
import { AUTH_NETWORK_ERROR, AUTH_UNEXPECTED_ERROR } from './authApiSafe.js';
import { formatUserError } from './userErrors.js';

export const SystemNotifyType = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  INVALID_CREDENTIALS: 'invalid_credentials',
  ACCOUNT_EXISTS: 'account_exists',
  OTP_INVALID: 'otp_invalid',
  OTP_EXPIRED: 'otp_expired',
  PROFILE_INCOMPLETE: 'profile_incomplete',
  BID_ACCEPTED: 'bid_accepted',
  BID_REJECTED: 'bid_rejected',
  BID_RECEIVED: 'bid_received',
  SHIPMENT_ASSIGNED: 'shipment_assigned',
  LOCATION_UPDATED: 'location_updated',
  LOAD_POSTED: 'load_posted',
  PROFILE_UPDATED: 'profile_updated'
};

/**
 * @param {string} type - SystemNotifyType or variant string
 * @param {string} message
 * @param {{ autoClose?: number }} [opts]
 */
export function notifySystem(type, message, opts = {}) {
  const text = String(message || '').trim();
  if (!text) return;

  const key = String(type || '').toLowerCase();
  switch (key) {
    case SystemNotifyType.SUCCESS:
    case 'success':
      notifySuccess(text, opts);
      break;
    case SystemNotifyType.ERROR:
    case 'error':
      notifyError(text, opts);
      break;
    case SystemNotifyType.WARNING:
    case 'warning':
    case SystemNotifyType.PROFILE_INCOMPLETE:
    case 'profile_incomplete':
      notifyWarning(text, opts);
      break;
    case SystemNotifyType.INVALID_CREDENTIALS:
    case 'invalid_credentials':
      notifyError(text, opts);
      break;
    case SystemNotifyType.ACCOUNT_EXISTS:
    case 'account_exists':
      notifyWarning(text, opts);
      break;
    case SystemNotifyType.OTP_INVALID:
    case 'otp_invalid':
    case SystemNotifyType.OTP_EXPIRED:
    case 'otp_expired':
      notifyError(text, opts);
      break;
    case SystemNotifyType.BID_ACCEPTED:
    case 'bid_accepted':
      notifyBidAccepted(text);
      break;
    case SystemNotifyType.BID_REJECTED:
    case 'bid_rejected':
      notifyBidRejected(text);
      break;
    case SystemNotifyType.BID_RECEIVED:
    case 'bid_received':
      notifyInfo(text, opts);
      break;
    case SystemNotifyType.SHIPMENT_ASSIGNED:
    case 'shipment_assigned':
      notifyContractStarted(text);
      break;
    case SystemNotifyType.LOCATION_UPDATED:
    case 'location_updated':
      notifyInfo(text, { autoClose: 2500, ...opts });
      break;
    case SystemNotifyType.LOAD_POSTED:
    case 'load_posted':
      notifyLoadPosted(text);
      break;
    case SystemNotifyType.PROFILE_UPDATED:
    case 'profile_updated':
      notifyProfileUpdated(text);
      break;
    default:
      notifyInfo(text, opts);
  }
}

/** Map socket / persisted notification rows to typed toasts. */
export function routeRealtimeNotification(normalized) {
  const msg = String(normalized?.message || '').trim();
  if (!msg) return;
  const type = String(normalized?.type || normalized?.title || '').toUpperCase();

  if (type.includes('BID_ACCEPTED') || (type.includes('ACCEPTED') && type.includes('BID'))) {
    notifySystem(SystemNotifyType.BID_ACCEPTED, msg);
    return;
  }
  if (type.includes('BID_REJECTED') || type.includes('REJECTED')) {
    notifySystem(SystemNotifyType.BID_REJECTED, msg);
    return;
  }
  if (type.includes('BID_RECEIVED') || type.includes('CONFIRMATION')) {
    notifySystem(SystemNotifyType.BID_RECEIVED, msg);
    return;
  }
  if (type.includes('SHIPMENT') || type.includes('ASSIGNED') || type.includes('BOOKED')) {
    notifySystem(SystemNotifyType.SHIPMENT_ASSIGNED, msg);
    return;
  }
  if (type.includes('LOAD_POSTED')) {
    notifySystem(SystemNotifyType.LOAD_POSTED, msg);
    return;
  }
  if (type.includes('TRACKING') || type.includes('LOCATION')) {
    notifySystem(SystemNotifyType.LOCATION_UPDATED, msg);
    return;
  }
  notifySystem(SystemNotifyType.INFO, msg);
}

/**
 * Unified auth error → user-facing toast text.
 * @param {unknown} err
 * @param {(key: string) => string} t
 * @param {'login'|'register'|'otp'|'reset'} flow
 */
export function mapAuthError(err, t, flow = 'login') {
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return AUTH_NETWORK_ERROR;
  }
  const { code, message, displayMessage } = unwrapErrorDetail(err);
  const msg = String(displayMessage || message || '').trim();

  if (flow === 'register') {
    if (code === 'WRONG_PASSWORD') return t('errors.wrongPasswordForRegister');
    if (code === 'INVALID_ROLE') return t('errors.invalidRole');
    if (code === 'EMAIL_ALREADY_EXISTS') return t('errors.accountAlreadyExists');
    if (code === 'VALIDATION_ERROR' && /passwords do not match/i.test(message || msg)) {
      return t('errors.passwordsDoNotMatch');
    }
  }

  if (flow === 'otp') {
    if (code === 'OTP_EXPIRED') return msg || t('errors.otpExpired');
    if (code === 'INVALID_OTP') return msg || t('errors.otpInvalid');
    if (code === 'OTP_COOLDOWN') return msg || t('errors.generic');
  }

  if (code === 'INVALID_CREDENTIALS') return t('errors.invalidCredentials');
  if (code === 'ACCOUNT_BLOCKED') return t('errors.accountBlocked');
  if (code === 'EMAIL_NOT_VERIFIED') return t('errors.emailNotVerified');
  if (code === 'INVALID_ROLE' || code === 'ROLE_NOT_AVAILABLE') return t('errors.invalidRole');
  if (code === 'EMAIL_ALREADY_EXISTS') return t('errors.accountAlreadyExists');
  if (code === 'OTP_EXPIRED') return msg || t('errors.otpExpired');
  if (code === 'INVALID_OTP') return msg || t('errors.otpInvalid');
  if (code === 'DATABASE_UNAVAILABLE') return t('errors.generic');

  return msg || t('errors.unexpectedAuth') || AUTH_UNEXPECTED_ERROR;
}

/** Show auth error toast (login/register/otp/reset). */
export function notifyAuthError(err, t, flow = 'login') {
  notifySystem(SystemNotifyType.ERROR, mapAuthError(err, t, flow));
}

/** Show a user-facing API error via the global toast router. */
export function notifyApiError(err, fallback = '') {
  const msg = formatUserError(err) || String(fallback || '').trim();
  if (msg) notifySystem(SystemNotifyType.ERROR, msg);
}

/** Client-side validation / UX message (non-API). */
export function notifyUserError(message, opts = {}) {
  const text = String(message || '').trim();
  if (text) notifySystem(SystemNotifyType.ERROR, text, opts);
}

export function notifyProfileIncomplete(t) {
  notifySystem(SystemNotifyType.PROFILE_INCOMPLETE, t('system.profileIncomplete'));
}
