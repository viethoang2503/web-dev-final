/**
 * NÂNG CẤP PREMIUM BẰNG QR (GIẢ LẬP): không có cổng thanh toán thật.
 * Luồng: người dùng tạo đơn → trang hiện QR chứa URL /pay.html?order=<code> → "ngân hàng" (trang pay) xác nhận
 * → server đánh dấu đơn đã trả và nâng gói → trang Upgrade hỏi lại trạng thái đơn và tự cập nhật.
 * code đơn là bí mật không đoán được (96 bit), nên trang pay không cần đăng nhập, giống quét QR bằng điện thoại khác.
 */
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';
import { config } from '../config/environment.js';
import { getDb, toPlain } from '../database/connection.js';
import { ApiError } from '../utils/http-response.js';
import { getUserById } from './auth.service.js';

export const PREMIUM_PRICE_VND = 5000;
const ORDER_TTL_MS = 10 * 60 * 1000;

/** Địa chỉ gốc để nhúng vào QR. Điện thoại không mở được "localhost" của máy tính, nên thay bằng IP LAN nếu có. */
function baseUrl(req) {
  if (config.publicUrl) return config.publicUrl;
  const host = req.get('host');
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host)) {
    const lan = Object.values(networkInterfaces()).flat().find((item) => item.family === 'IPv4' && !item.internal);
    if (lan) return `${req.protocol}://${lan.address}:${config.port}`;
  }
  return `${req.protocol}://${host}`;
}

function toOrder(row, req) {
  const expired = row.status === 'pending' && row.expires_at < Date.now();
  return {
    code: row.code,
    amountVnd: row.amount_vnd,
    status: expired ? 'expired' : row.status,
    expiresAt: row.expires_at,
    memo: `HL${row.code.slice(0, 6).toUpperCase()}`,
    payUrl: `${baseUrl(req)}/pay.html?order=${row.code}`,
  };
}

function findOrder(code) {
  return getDb().prepare('SELECT * FROM payment_orders WHERE code = ?').get(String(code));
}

/** Tạo đơn mới, hoặc dùng lại đơn đang chờ còn hạn của người dùng để không sinh đơn rác. */
export function createOrder(user, req) {
  if (user.premium) throw ApiError.conflict('Your account already has Premium.');
  const db = getDb();
  const open = db
    .prepare("SELECT * FROM payment_orders WHERE user_id = ? AND status = 'pending' AND expires_at >= ? ORDER BY id DESC LIMIT 1")
    .get(user.id, Date.now());
  if (open) return toOrder(open, req);

  const code = randomBytes(12).toString('hex');
  db.prepare('INSERT INTO payment_orders (user_id, code, amount_vnd, expires_at) VALUES (?, ?, ?, ?)')
    .run(user.id, code, PREMIUM_PRICE_VND, Date.now() + ORDER_TTL_MS);
  return toOrder(findOrder(code), req);
}

/** Đơn của chính người dùng (người khác nhận 404 để không lộ đơn tồn tại). */
export function getOwnOrder(userId, code, req) {
  const row = findOrder(code);
  if (!row || row.user_id !== userId) throw ApiError.notFound('Order not found.');
  const order = toOrder(row, req);
  return order.status === 'paid' ? { ...order, user: { ...getUserById(userId), premium: true } } : order;
}

/** Thông tin hiển thị trên trang "ngân hàng" (không có dữ liệu cá nhân). */
export function getOrderForPayment(code, req) {
  const row = findOrder(code);
  if (!row) throw ApiError.notFound('Order not found.');
  const { amountVnd, status, memo } = toOrder(row, req);
  return { amountVnd, status, memo };
}

/** Ảnh QR (SVG) chứa URL trang thanh toán của đơn. */
export async function orderQrSvg(code, req) {
  const row = findOrder(code);
  if (!row) throw ApiError.notFound('Order not found.');
  return QRCode.toString(toOrder(row, req).payUrl, { type: 'svg', margin: 1, width: 240, errorCorrectionLevel: 'M' });
}

/** Xác nhận thanh toán: đánh dấu đơn, nâng gói và ghi sổ trong một transaction. Gọi lại nhiều lần vẫn an toàn. */
export function payOrder(code) {
  const row = findOrder(code);
  if (!row) throw ApiError.notFound('Order not found.');
  if (row.status === 'paid') return { status: 'paid' };
  if (row.expires_at < Date.now()) throw ApiError.conflict('This QR code has expired. Create a new one on the upgrade page.');

  const db = getDb();
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE payment_orders SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(row.id);
    db.prepare("UPDATE users SET plan = 'premium' WHERE id = ?").run(row.user_id);
    db.prepare('INSERT INTO payments (user_id, amount_vnd, method) VALUES (?, ?, ?)').run(row.user_id, row.amount_vnd, 'qr-demo');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { status: 'paid' };
}
