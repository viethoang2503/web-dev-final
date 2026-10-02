/**
 * ĐIỂM BẮT ĐẦU BACKEND: npm start chạy file này.
 * Luồng yêu cầu: /api → router → service → SQLite → JSON; các URL trang web → file tĩnh.
 * Frontend và API cùng địa chỉ/cổng nên trình duyệt gọi được /api/spots bằng đường dẫn tương đối.
 */
/** Một server phục vụ trang tĩnh và API món ăn/địa điểm trên cùng cổng. */
import express from 'express';
import { config } from './config/environment.js';
import { apiRouter } from './routes/api.routes.js';
import { apiNotFound, errorHandler } from './middleware/error-handler.middleware.js';
import { requireAdminPage, requireUserPage } from './middleware/auth.middleware.js';
import { resolveImage } from './middleware/image-resolver.middleware.js';
import { initDatabase } from './database/initialize.js';

// Tạo bảng nếu chưa có. File dữ liệu cũ được giữ nguyên.
initDatabase();

const app = express();

app.disable('x-powered-by');

// API được kiểm tra trước các file HTML/CSS/JS.
app.use('/api', apiRouter);
app.use('/api', apiNotFound);

// Trang lập lịch cần đăng nhập; trang quản trị cần quyền admin. Kiểm tra trước khi phát file tĩnh.
app.get(['/plan', '/plan.html'], requireUserPage);
app.get(['/admin', '/admin.html'], requireAdminPage);

// Ảnh của catalogue dùng URL không có đuôi; middleware chọn WebP/AVIF hiện có.
app.use(resolveImage);

app.use(
  express.static(config.publicDir, {
    extensions: ['html'],
    maxAge: config.isProduction ? '1h' : 0,
  })
);

// Đặt bộ xử lý lỗi sau các route để nhận lỗi được chuyển xuống từ những bước trước.
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[server] Hanoi Local running at http://localhost:${config.port}`);
  console.log(`[server] Database: ${config.databasePath}`);
});

// Khi dừng tiến trình, ngừng nhận kết nối và chờ server đóng trước khi thoát.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
