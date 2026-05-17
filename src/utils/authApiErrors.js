import { unwrapErrorDetail } from './unwrapApi.js';
import { AUTH_UNEXPECTED_ERROR } from './authApiSafe.js';

export { AUTH_UNEXPECTED_ERROR };

/**
 * Toast / inline text for POST /auth/register failures (uses API `code` when present).
 * @param {unknown} err
 * @param {(key: string) => string} t
 */
export function getRegisterErrorToast(err, t) {
  const { code, message, displayMessage } = unwrapErrorDetail(err);
  const msg = String(displayMessage || message || '').trim() || AUTH_UNEXPECTED_ERROR;

  if (code === 'WRONG_PASSWORD') return t('errors.wrongPasswordForRegister');
  if (code === 'INVALID_ROLE') return t('errors.invalidRole');
  if (code === 'VALIDATION_ERROR' && /passwords do not match/i.test(message || msg)) {
    return t('errors.passwordsDoNotMatch');
  }
  if (code === 'VALIDATION_ERROR') return message || msg;
  if (code === 'EMAIL_ALREADY_EXISTS') return message || msg;
  if (code === 'DATABASE_UNAVAILABLE') return message || msg;
  return msg;
}

/**
 * OTP verify / resend errors on verify-email and similar.
 * @param {unknown} err
 * @param {(key: string) => string} t
 */
export function getOtpFlowErrorToast(err, t) {
  const { code, message, displayMessage } = unwrapErrorDetail(err);
  const msg = String(displayMessage || message || '').trim() || AUTH_UNEXPECTED_ERROR;

  if (code === 'OTP_EXPIRED') return message || t('errors.otpExpired');
  if (code === 'INVALID_OTP') {
    if (message && /attempt/i.test(message)) return message;
    return message || t('errors.otpInvalid');
  }
  if (code === 'OTP_COOLDOWN') return message || msg;
  if (code === 'VALIDATION_ERROR') return message || msg;
  if (code === 'DATABASE_UNAVAILABLE') return message || msg;
  return msg;
}
