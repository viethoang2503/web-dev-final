/**
 * QUY ƯỚC PHẢN HỒI: các API dùng chung hàm trả JSON để frontend đọc nhất quán.
 * Danh sách: { data: [...], meta: { count, ... } }; một mục: { data: {...} }; lỗi: { error: {...} }.
 */
/** Định dạng phản hồi chung: {data, meta} hoặc {error}. */

/** Mã lỗi thống nhất để phía gọi có thể phân biệt từng trường hợp. */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

/** Thông báo mặc định cho từng mã lỗi, không chứa SQL hoặc stack trace nội bộ. */
const DEFAULT_MESSAGES = {
  [ErrorCode.VALIDATION_ERROR]: 'Please check the submitted fields.',
  [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCode.INTERNAL_ERROR]: 'Something went wrong. Please try again.',
};

const STATUS_BY_CODE = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.INTERNAL_ERROR]: 500,
};

/**
 * ApiError mang mã lỗi và HTTP status. Router ném lỗi này, middleware sẽ trả JSON tương ứng.
 * Những lỗi khác được chuyển thành lỗi 500 với thông báo chung.
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

  static notFound(message) {
    return new ApiError(ErrorCode.NOT_FOUND, message);
  }

}

/** Trả danh sách kèm số phần tử trong meta.count. */
export function sendList(res, items, meta = {}) {
  return res.json({ data: items, meta: { count: items.length, ...meta } });
}

/** Trả một đối tượng với HTTP status, mặc định 200. */
export function sendObject(res, item, status = 200) {
  return res.status(status).json({ data: item });
}

/** Middleware gọi hàm này để trả status và nội dung lỗi theo cùng cấu trúc. */
export function sendError(res, error) {
  const apiError = error instanceof ApiError ? error : new ApiError(ErrorCode.INTERNAL_ERROR);
  const body = { error: { code: apiError.code, message: apiError.message } };
  if (apiError.details) {
    body.error.details = apiError.details;
  }
  return res.status(apiError.status).json(body);
}
