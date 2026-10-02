/**
 * XỬ LÝ LỖI TẬP TRUNG: API không tồn tại trả 404; dữ liệu sai trả 400; lỗi bất ngờ trả 500.
 * Chi tiết kỹ thuật được ghi ở server; trình duyệt nhận cấu trúc { error: { code, message } }.
 */
/**
 * Lỗi route và lỗi xử lý đều đi qua đây để thống nhất phản hồi.
 * Không gửi SQL hoặc stack trace nội bộ về trình duyệt.
 */
import { ApiError, ErrorCode, sendError } from '../utils/http-response.js';

/** Bắt yêu cầu /api không khớp route nào, sau khi đã thử các API hợp lệ. */
export function apiNotFound(req, res, next) {
  next(ApiError.notFound(`No API route matches ${req.method} ${req.originalUrl}`));
}

/** Express nhận diện middleware lỗi nhờ đủ bốn tham số err, req, res, next. */
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

  // Body JSON sai cú pháp (express.json trong api.routes.js).
  if (err?.type === 'entity.parse.failed') {
    return sendError(res, ApiError.validation('The request body is not valid JSON.'));
  }

  console.error(`[api] Unhandled error on ${req.method} ${req.originalUrl}`, err);
  return sendError(res, new ApiError(ErrorCode.INTERNAL_ERROR));
}
