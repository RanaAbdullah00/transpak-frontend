import { formatStructuredApiError, unwrapErrorCode } from './unwrapApi.js';

/** Normalize axios auth errors for UI mappers (login/register/otp). */
export function enrichAuthAxiosError(err) {
  if (!err || typeof err !== 'object') return err;
  const structured = formatStructuredApiError(err);
  err.code = unwrapErrorCode(err) || err.code || structured.type || null;
  err.structured = structured;
  return err;
}

/** Reject API envelopes that return HTTP 200 with success:false. */
export function rejectAuthEnvelope(data, status = 400) {
  if (data && typeof data.success === 'boolean' && data.success === false) {
    const err = new Error(
      typeof data.message === 'string' && data.message.trim() ? data.message.trim() : 'Request failed'
    );
    err.response = { status, data };
    throw enrichAuthAxiosError(err);
  }
}
