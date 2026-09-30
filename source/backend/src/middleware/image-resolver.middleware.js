/**
 * PHỤC VỤ ẢNH: với URL ảnh không có đuôi, thử AVIF → WebP → JPG → JPEG → PNG.
 * Đây là thứ tự ưu tiên cố định, không đo dung lượng hay thương lượng định dạng theo trình duyệt.
 * Không tìm thấy ảnh thì trả ảnh thay thế; URL đã có đuôi được chuyển cho express.static.
 */
/**
 * Ảnh có thể được gọi bằng URL không có đuôi, ví dụ /assets/images/spots/food-pho-bo.
 * Middleware tìm định dạng có sẵn hoặc trả placeholder để tránh biểu tượng ảnh hỏng.
 * Cache kết quả đường dẫn chỉ được dùng khi chạy production.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config/environment.js';

/** Ưu tiên định dạng theo thứ tự cố định; không đo file nào nhỏ nhất. */
const EXTENSIONS = ['.avif', '.webp', '.jpg', '.jpeg', '.png'];

const PLACEHOLDER = '/assets/images/placeholder.svg';

/**
 * Map ánh xạ đường dẫn yêu cầu sang file thật, hoặc null nếu không có ảnh.
 * Development không cache để nhận ảnh mới ngay khi thêm/thay/xóa file.
 */
const cache = new Map();

// Tra cache ở production; nếu chưa có thì kiểm tra file trên đĩa theo thứ tự định dạng ưu tiên.
function resolve(relativePath) {
  if (config.isProduction && cache.has(relativePath)) {
    return cache.get(relativePath);
  }

  const absoluteBase = path.join(config.publicDir, relativePath);
  const resolved =
    EXTENSIONS.map((extension) => `${absoluteBase}${extension}`).find((candidate) =>
      existsSync(candidate)
    ) ?? null;

  if (config.isProduction) {
    cache.set(relativePath, resolved);
  }
  return resolved;
}

/**
 * Chỉ xử lý URL ảnh không có đuôi; những URL khác tiếp tục sang express.static.
 */
export function resolveImage(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const requested = decodeURIComponent(req.path);
  if (!requested.startsWith('/assets/images/')) return next();
  if (path.extname(requested) !== '') return next();

  // Chuẩn hóa đường dẫn và chỉ tiếp tục khi vẫn nằm trong vùng URL ảnh.
  const normalised = path.posix.normalize(requested);
  if (!normalised.startsWith('/assets/images/') || normalised.includes('..')) {
    return next();
  }

  const relativePath = normalised.slice(1);
  const resolved = resolve(relativePath);

  /** Thiếu ảnh thì trả placeholder và gắn header để công cụ QA nhận biết. */
  const sendPlaceholder = () => {
    res.set('X-Image-Placeholder', 'true');
    res.sendFile(path.join(config.publicDir, PLACEHOLDER.slice(1)), { maxAge: 0 }, (error) => {
      // Nếu cả placeholder cũng lỗi thì chuyển lỗi sang middleware tiếp theo.
      if (error) next(error);
    });
  };

  if (!resolved) {
    return sendPlaceholder();
  }

  return res.sendFile(resolved, { maxAge: config.isProduction ? '30d' : 0 }, (error) => {
    if (!error) return;

    // Nếu ảnh bị xóa sau khi kiểm tra nhưng trước khi gửi, bỏ cache cũ
    // và thử trả placeholder khi chưa gửi header phản hồi.
    if (error.code === 'ENOENT') {
      cache.delete(relativePath);
      if (!res.headersSent) return sendPlaceholder();
      return;
    }

    next(error);
  });
}

/** Hàm tiện ích xóa cache đường dẫn ảnh khi cần làm mới kết quả. */
export function clearImageCache() {
  cache.clear();
}
