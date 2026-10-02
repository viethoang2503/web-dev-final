/**
 * DỊCH VỤ TÀI KHOẢN: đăng ký / đăng nhập bằng email + mật khẩu, đăng nhập Google, và cookie phiên.
 * Mật khẩu chỉ lưu dạng băm scrypt có salt. Cookie phiên là "userId.hạn.chữ ký HMAC" nên không cần bảng sessions;
 * đổi SESSION_SECRET sẽ làm mọi phiên hết hiệu lực.
 */
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/environment.js';
import { getDb, toPlain } from '../database/connection.js';
import { ApiError } from '../utils/http-response.js';

export const SESSION_COOKIE = 'hl_session';
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const scryptAsync = promisify(scrypt);
const googleClient = new OAuth2Client();
const PUBLIC_COLUMNS = 'id, email, name, picture, role, plan';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Mật khẩu ------------------------------------------------------------

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

// ---- Đọc / ghi người dùng ---------------------------------------------------

export function getUserById(id) {
  return toPlain(getDb().prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`).get(id));
}

/**
 * Bước cuối cho mọi người dùng trả về client: email nằm trong ADMIN_EMAILS thì nâng lên admin
 * (không bao giờ tự hạ quyền ai), rồi tính `premium` = gói premium hoặc là admin.
 */
function promoteIfListed(user) {
  let result = user;
  if (user.role !== 'admin' && config.adminEmails.includes(user.email.toLowerCase())) {
    getDb().prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
    result = { ...user, role: 'admin' };
  }
  return { ...result, premium: result.role === 'admin' || result.plan === 'premium' };
}

function cleanEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw ApiError.validation('Enter a valid email address.');
  return email;
}

// ---- Đăng ký / đăng nhập bằng mật khẩu --------------------------------------------

export async function registerUser({ name, email, password }) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (cleanName.length < 1 || cleanName.length > 80) throw ApiError.validation('Enter your name (up to 80 characters).');
  const cleanedEmail = cleanEmail(email);
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw ApiError.validation('Password must be 8 to 128 characters.');
  }

  const db = getDb();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(cleanedEmail)) {
    throw ApiError.conflict('An account with this email already exists. Try signing in.');
  }

  const result = db
    .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
    .run(cleanedEmail, cleanName, await hashPassword(password));
  return promoteIfListed(getUserById(Number(result.lastInsertRowid)));
}

// Giới hạn số lần đăng nhập sai theo IP + email để chặn dò mật khẩu (trong bộ nhớ, đủ cho một server).
const failures = new Map();
const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;

function failureKey(ip, email) {
  return `${ip}|${email}`;
}

function assertNotLocked(key) {
  const entry = failures.get(key);
  if (!entry) return;
  if (Date.now() - entry.first > WINDOW_MS) failures.delete(key);
  else if (entry.count >= MAX_FAILURES) throw ApiError.rateLimited();
}

function recordFailure(key) {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
}

export async function loginWithPassword({ email, password }, ip = '') {
  const cleanedEmail = cleanEmail(email);
  const key = failureKey(ip, cleanedEmail);
  assertNotLocked(key);

  const row = getDb().prepare(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = ?`).get(cleanedEmail);
  // Cùng một thông báo cho "không có tài khoản", "sai mật khẩu" và "tài khoản chỉ dùng Google".
  if (!row || typeof password !== 'string' || !(await verifyPassword(password, row.password_hash))) {
    recordFailure(key);
    throw ApiError.unauthorized('Incorrect email or password.');
  }

  failures.delete(key);
  const { password_hash: _hash, ...user } = toPlain(row);
  return promoteIfListed(user);
}

// ---- Google ---------------------------------------------------------------

/** Xác minh chữ ký, hạn và audience của token do Google cấp; trả về thông tin hồ sơ. */
export async function verifyGoogleCredential(credential) {
  if (!config.googleClientId) {
    throw ApiError.validation('Google sign-in is not configured on the server.');
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified === false) {
      throw new Error('Incomplete Google profile');
    }
    return { sub: payload.sub, email: payload.email.toLowerCase(), name: payload.name ?? payload.email, picture: payload.picture ?? null };
  } catch {
    throw ApiError.unauthorized('Google sign-in could not be verified.');
  }
}

/**
 * Tìm theo google_sub; nếu chưa có thì nối vào tài khoản cùng email (Google đã xác minh email);
 * nếu vẫn chưa có thì tạo mới.
 */
export function upsertGoogleUser(profile) {
  const db = getDb();
  const bySub = db.prepare('SELECT id FROM users WHERE google_sub = ?').get(profile.sub);
  const byEmail = bySub ? null : db.prepare('SELECT id FROM users WHERE email = ?').get(profile.email);

  let id;
  if (bySub || byEmail) {
    id = (bySub ?? byEmail).id;
    db.prepare('UPDATE users SET google_sub = ?, picture = ? WHERE id = ?').run(profile.sub, profile.picture, id);
  } else {
    id = Number(
      db
        .prepare('INSERT INTO users (google_sub, email, name, picture) VALUES (?, ?, ?, ?)')
        .run(profile.sub, profile.email, profile.name, profile.picture).lastInsertRowid
    );
  }
  return promoteIfListed(getUserById(id));
}

// ---- Cookie phiên ---------------------------------------------------------

function sign(text) {
  return createHmac('sha256', config.sessionSecret).update(text).digest('hex');
}

/** Giá trị cookie cho một người dùng, có hạn dùng và chữ ký. */
export function createSessionToken(userId) {
  const body = `${userId}.${Date.now() + SESSION_MAX_AGE_MS}`;
  return `${body}.${sign(body)}`;
}

/** Trả về userId nếu cookie đúng chữ ký và chưa hết hạn, ngược lại null. */
export function readSessionToken(token) {
  if (typeof token !== 'string') return null;
  const [userId, expires, signature] = token.split('.');
  if (!userId || !expires || !signature) return null;

  const expected = Buffer.from(sign(`${userId}.${expires}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  if (Number(expires) < Date.now()) return null;
  return Number(userId);
}

/** Đọc một cookie từ header Cookie mà không cần thư viện cookie-parser. */
export function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

/** Người dùng đang đăng nhập theo cookie của yêu cầu, hoặc null. Admin trong ADMIN_EMAILS luôn được nâng quyền. */
export function currentUser(req) {
  const userId = readSessionToken(readCookie(req, SESSION_COOKIE));
  const user = userId ? getUserById(userId) : undefined;
  return user ? promoteIfListed(user) : null;
}
