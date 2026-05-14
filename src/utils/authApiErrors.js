import { unwrapErrorMessage, unwrapErrorCode } from './unwrapApi.js';

/**
 * Toast / inline text for POST /auth/register failures (uses API `code` when present).
 * @param {unknown} err
 * @param {(key: string) => string} t
 */
export function getRegisterErrorToast(err, t) {
  const code = unwrapErrorCode(err);
  const msg = String(unwrapErrorMessage(err) || '').trim() || t('auth.registrationFailed');

  if (code === 'WRONG_PASSWORD') return t('errors.wrongPasswordForRegister');
  if (code === 'INVALID_ROLE') return t('errors.invalidRole');
  if (code === 'VALIDATION_ERROR' && /passwords do not match/i.test(msg)) {
    return t('errors.passwordsDoNotMatch');
  }
  if (code === 'VALIDATION_ERROR') return msg;
  if (code === 'EMAIL_ALREADY_EXISTS') return msg;
  if (code === 'SERVER_ERROR') return t('errors.generic');
  return msg;
}

/**
 * OTP verify / resend errors on verify-email and similar.
 * @param {unknown} err
 * @param {(key: string) => string} t
 */
export function getOtpFlowErrorToast(err, t) {
  const code = unwrapErrorCode(err);
  const msg = String(unwrapErrorMessage(err) || '').trim() || t('errors.generic');

  if (code === 'OTP_EXPIRED') return t('errors.otpExpired');
  if (code === 'INVALID_OTP') return msg.includes('attempt') ? msg : t('errors.otpInvalid');
  if (code === 'OTP_COOLDOWN') return msg;
  if (code === 'VALIDATION_ERROR') return msg;
  return msg;
}
