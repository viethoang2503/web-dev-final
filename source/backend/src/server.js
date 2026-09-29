/** Một server phục vụ trang tĩnh và API món ăn/địa điểm trên cùng cổng. */
import express from 'express';
import { config } from './config/environment.js';
import { apiRouter } from './routes/api.routes.js';
import { apiNotFound, errorHandler } from './middleware/error-handler.middleware.js';
import { resolveImage } from './middleware/image-resolver.middleware.js';
import { initDatabase } from './database/initialize.js';

// Tạo bảng nếu chưa có. File dữ liệu cũ được giữ nguyên.
initDatabase();

const app = express();

app.disable('x-powered-by');

// API được kiểm tra trước các file HTML/CSS/JS.
app.use('/api', apiRouter);
app.use('/api', apiNotFound);

// Ảnh của catalogue dùng URL không có đuôi; middleware chọn WebP/AVIF hiện có.
app.use(resolveImage);

app.use(
  express.static(config.publicDir, {
    extensions: ['html'],
    maxAge: config.isProduction ? '1h' : 0,
  })
);

app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[server] Hanoi Local running at http://localhost:${config.port}`);
  console.log(`[server] Database: ${config.databasePath}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
