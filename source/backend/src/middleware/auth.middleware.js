/**
 * BẢO VỆ ROUTE: requireUser/requireAdmin cho API (trả 401/403 dạng JSON),
 * requireUserPage/requireAdminPage cho trang HTML (chuyển hướng sang trang đăng nhập hoặc trang chủ).
 */
import { ApiError } from '../utils/http-response.js';
import { currentUser } from '../services/auth.service.js';

export function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) throw ApiError.unauthorized();
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  requireUser(req, res, () => {
    if (req.user.role !== 'admin') throw ApiError.forbidden('Administrator access is required.');
    next();
  });
}

// Trang được bảo vệ không được lưu cache dùng chung, để sau khi đăng xuất nút Back không hiện lại trang cũ.
function guardPage(allow, onDenied) {
  return (req, res, next) => {
    const user = currentUser(req);
    res.set('Cache-Control', 'private, no-cache');
    if (user && allow(user)) return next();
    return onDenied(req, res, user);
  };
}

export const requireUserPage = guardPage(
  () => true,
  (req, res) => res.redirect(`/login.html?next=${encodeURIComponent(req.originalUrl)}`)
);

export const requireAdminPage = guardPage(
  (user) => user.role === 'admin',
  (req, res, user) => res.redirect(user ? '/' : `/login.html?next=${encodeURIComponent(req.originalUrl)}`)
);
