/**
 * API NÂNG CẤP (gắn vào /api/billing), thanh toán QR giả lập:
 * GET /plans: giá Premium. Người đã đăng nhập: POST /orders tạo đơn, GET /orders/:code xem trạng thái.
 * Theo code đơn (bí mật trong QR): GET /orders/:code/qr.svg ảnh QR, GET và POST /pay/:code cho trang "ngân hàng".
 */
import { Router } from 'express';
import { requireUser } from '../middleware/auth.middleware.js';
import { sendObject } from '../utils/http-response.js';
import {
  PREMIUM_PRICE_VND,
  createOrder,
  getOrderForPayment,
  getOwnOrder,
  orderQrSvg,
  payOrder,
} from '../services/billing.service.js';

export const billingRouter = Router();

billingRouter.get('/plans', (req, res) => {
  sendObject(res, { premium: { priceVnd: PREMIUM_PRICE_VND } });
});

billingRouter.post('/orders', requireUser, (req, res) => {
  sendObject(res, createOrder(req.user, req), 201);
});

billingRouter.get('/orders/:code', requireUser, (req, res) => {
  res.set('Cache-Control', 'no-store');
  sendObject(res, getOwnOrder(req.user.id, req.params.code, req));
});

billingRouter.get('/orders/:code/qr.svg', async (req, res) => {
  res.type('image/svg+xml').set('Cache-Control', 'no-store').send(await orderQrSvg(req.params.code, req));
});

billingRouter.get('/pay/:code', (req, res) => {
  res.set('Cache-Control', 'no-store');
  sendObject(res, getOrderForPayment(req.params.code, req));
});

billingRouter.post('/pay/:code', (req, res) => {
  sendObject(res, payOrder(req.params.code));
});
