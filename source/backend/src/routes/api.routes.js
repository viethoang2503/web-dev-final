/**
 * BỘ ĐỊNH TUYẾN API: server gắn router này vào /api.
 * Vì vậy /health ở đây trở thành /api/health; /spots được chuyển tiếp sang spotsRouter.
 */
/** Hai API công khai: kiểm tra server và lấy danh sách món/địa điểm. */
import express, { Router } from 'express';
import { adminRouter } from './admin.routes.js';
import { billingRouter } from './billing.routes.js';
import { authRouter } from './auth.routes.js';
import { spotsRouter } from './spots.routes.js';

export const apiRouter = Router();

// Đọc body JSON cho các API ghi dữ liệu (đăng nhập, quản trị). Giới hạn kích thước để tránh body quá lớn.
apiRouter.use(express.json({ limit: '20kb' }));

// Dùng để kiểm tra server khi demo và benchmark.
apiRouter.get('/health', (req, res) => {
  res.json({ data: { status: 'ok', time: new Date().toISOString() } });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/billing', billingRouter);
apiRouter.use('/spots', spotsRouter);
