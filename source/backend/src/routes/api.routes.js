/** Hai API công khai: kiểm tra server và lấy danh sách món/địa điểm. */
import { Router } from 'express';
import { spotsRouter } from './spots.routes.js';

export const apiRouter = Router();

// Dùng để kiểm tra server khi demo và benchmark.
apiRouter.get('/health', (req, res) => {
  res.json({ data: { status: 'ok', time: new Date().toISOString() } });
});

apiRouter.use('/spots', spotsRouter);
