/**
 * Shared API response format (Technical Spec section 5).
 *
 * Every endpoint in the project must answer with one of these shapes so the
 * frontend can rely on a single parsing path:
 *
 *   list    { "data": [...], "meta": { "count": n } }
 *   object  { "data": {...} }
 *   error   { "error": { "code": "...", "message": "..." } }
 */

/** Stable error codes the frontend is allowed to branch on. */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

/** Default browser-safe message per code. Never leak SQL or stack details. */
const DEFAULT_MESSAGES = {
  [ErrorCode.VALIDATION_ERROR]: 'Please check the submitted fields.',
  [ErrorCode.UNAUTHENTICATED]: 'Please sign in to continue.',
  [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCode.CONFLICT]: 'That resource already exists.',
  [ErrorCode.INTERNAL_ERROR]: 'Something went wrong. Please try again.',
};

const STATUS_BY_CODE = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.INTERNAL_ERROR]: 500,
};

/**
 * Error type route handlers throw. The error middleware turns it into the
 * documented envelope; anything else becomes a generic 500.
 */
export class ApiError extends Error {
  constructor(code, message, { details, cause } = {}) {
    super(message ?? DEFAULT_MESSAGES[code] ?? DEFAULT_MESSAGES.INTERNAL_ERROR, { cause });
    this.name = 'ApiError';
    this.code = code in STATUS_BY_CODE ? code : ErrorCode.INTERNAL_ERROR;
    this.status = STATUS_BY_CODE[this.code];
    this.details = details;
  }

  static validation(message, details) {
    return new ApiError(ErrorCode.VALIDATION_ERROR, message, { details });
  }

  static unauthenticated(message) {
    return new ApiError(ErrorCode.UNAUTHENTICATED, message);
  }

  static notFound(message) {
    return new ApiError(ErrorCode.NOT_FOUND, message);
  }

  static conflict(message) {
    return new ApiError(ErrorCode.CONFLICT, message);
  }
}

/** Send a list payload with a count in meta. */
export function sendList(res, items, meta = {}) {
  return res.json({ data: items, meta: { count: items.length, ...meta } });
}

/** Send a single object payload. */
export function sendObject(res, item, status = 200) {
  return res.status(status).json({ data: item });
}

/** Send an empty success response (used by DELETE endpoints later). */
export function sendNoContent(res) {
  return res.status(204).end();
}

/** Send an error envelope. Called by the error middleware, not by routes. */
export function sendError(res, error) {
  const apiError = error instanceof ApiError ? error : new ApiError(ErrorCode.INTERNAL_ERROR);
  const body = { error: { code: apiError.code, message: apiError.message } };
  if (apiError.details) {
    body.error.details = apiError.details;
  }
  return res.status(apiError.status).json(body);
}
