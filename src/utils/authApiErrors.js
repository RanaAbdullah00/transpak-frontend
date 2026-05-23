import { mapAuthError } from './notifySystem.js';

/** @deprecated Use mapAuthError(err, t, 'register') */
export function getRegisterErrorToast(err, t) {
  return mapAuthError(err, t, 'register');
}

/** @deprecated Use mapAuthError(err, t, 'otp') */
export function getOtpFlowErrorToast(err, t) {
  return mapAuthError(err, t, 'otp');
}

/** @deprecated Use mapAuthError(err, t, 'login') */
export function getLoginErrorToast(err, t) {
  return mapAuthError(err, t, 'login');
}
