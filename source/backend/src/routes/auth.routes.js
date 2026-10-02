/**
 * API TÀI KHOẢN (gắn vào /api/auth):
 * GET /config: Client ID cho nút Google; GET /me: người đang đăng nhập (hoặc null);
 * POST /register, /login: email + mật khẩu; POST /google: đổi ID token lấy cookie phiên; POST /logout: xóa cookie.
 */
import { Router } from 'express';
import { config } from '../config/environment.js';
import { ApiError, sendObject } from '../utils/http-response.js';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  createSessionToken,
  currentUser,
  loginWithPassword,
  registerUser,
  upsertGoogleUser,
  verifyGoogleCredential,
} from '../services/auth.service.js';

export const authRouter = Router();

// httpOnly: JavaScript trong trang không đọc được cookie; sameSite=lax chặn gửi cookie từ trang khác cho POST.
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: config.isProduction, path: '/' };

/** Đặt cookie phiên và trả thông tin người dùng. */
function startSession(res, user, status = 200) {
  res.cookie(SESSION_COOKIE, createSessionToken(user.id), { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });
  return sendObject(res, user, status);
}

authRouter.get('/config', (req, res) => {
  sendObject(res, { googleClientId: config.googleClientId || null });
});

authRouter.get('/me', (req, res) => {
  sendObject(res, currentUser(req));
});

authRouter.post('/register', async (req, res) => {
  startSession(res, await registerUser(req.body ?? {}), 201);
});

authRouter.post('/login', async (req, res) => {
  startSession(res, await loginWithPassword(req.body ?? {}, req.ip));
});

authRouter.post('/google', async (req, res) => {
  const credential = req.body?.credential;
  if (typeof credential !== 'string' || !credential) {
    throw ApiError.validation('credential is required.');
  }
  startSession(res, upsertGoogleUser(await verifyGoogleCredential(credential)));
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  sendObject(res, null);
});
