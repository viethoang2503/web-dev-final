/**
 * Central 404 and error handling (Technical Spec section 9).
 *
 * Internal details are logged on the server only; the browser always receives
 * the documented error envelope.
 */
import { ApiError, ErrorCode, sendError } from '../utils/http-response.js';

/** Unmatched /api/* request. Mounted after all API routes. */
export function apiNotFound(req, res, next) {
  next(ApiError.notFound(`No API route matches ${req.method} ${req.originalUrl}`));
}

/** Express error middleware. Must keep all four arguments. */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ApiError) {
    if (err.status >= 500) {
      console.error(`[api] ${req.method} ${req.originalUrl}`, err);
    }
    return sendError(res, err);
  }

  // Malformed JSON body from express.json().
  if (err?.type === 'entity.parse.failed') {
    return sendError(res, ApiError.validation('The request body is not valid JSON.'));
  }

  console.error(`[api] Unhandled error on ${req.method} ${req.originalUrl}`, err);
  return sendError(res, new ApiError(ErrorCode.INTERNAL_ERROR));
}
