/**
 * DỊCH VỤ QUẢN TRỊ: danh sách / đổi quyền / xóa người dùng và thêm / sửa / xóa món ăn, địa điểm.
 * Mọi dữ liệu từ form được kiểm tra ở validateSpot trước khi chạm vào SQL.
 * Lưu ý: quán của từng món nằm trong data/food-venues.js, không sửa được từ trang quản trị.
 */
import { getDb, toPlain } from '../database/connection.js';
import { ApiError } from '../utils/http-response.js';
import { SPOT_KINDS, getSpotById } from './spots.service.js';

// ---- Người dùng ------------------------------------------------------------

export function listUsers() {
  return getDb()
    .prepare(
      `SELECT id, email, name, picture, role, plan, created_at AS createdAt,
              password_hash IS NOT NULL AS hasPassword, google_sub IS NOT NULL AS hasGoogle
         FROM users ORDER BY created_at DESC, id DESC`
    )
    .all()
    .map((row) => ({ ...toPlain(row), hasPassword: !!row.hasPassword, hasGoogle: !!row.hasGoogle }));
}

function requireOtherUser(actorId, targetId) {
  if (actorId === targetId) throw ApiError.validation('You cannot change or delete your own account here.');
  const target = getDb().prepare('SELECT id, role FROM users WHERE id = ?').get(targetId);
  if (!target) throw ApiError.notFound(`No user found with id ${targetId}.`);
  return target;
}

export function setUserRole(actorId, targetId, role) {
  if (!['user', 'admin'].includes(role)) throw ApiError.validation('role must be "user" or "admin".');
  requireOtherUser(actorId, targetId);
  getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetId);
}

/** Đổi gói free/premium; được phép với cả chính mình vì không ảnh hưởng quyền truy cập. */
export function setUserPlan(targetId, plan) {
  if (!['free', 'premium'].includes(plan)) throw ApiError.validation('plan must be "free" or "premium".');
  const result = getDb().prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, targetId);
  if (result.changes === 0) throw ApiError.notFound(`No user found with id ${targetId}.`);
}

export function deleteUser(actorId, targetId) {
  requireOtherUser(actorId, targetId);
  getDb().prepare('DELETE FROM users WHERE id = ?').run(targetId);
}

// ---- Món ăn / địa điểm ---------------------------------------------------------

function text(body, key, { required = false, max = 2000 } = {}) {
  const value = typeof body[key] === 'string' ? body[key].trim() : '';
  if (required && !value) throw ApiError.validation(`${key} is required.`);
  if (value.length > max) throw ApiError.validation(`${key} must be at most ${max} characters.`);
  return value || null;
}

function number(body, key, { min, max, integer = false, required = false } = {}) {
  const raw = body[key];
  if (raw === undefined || raw === null || raw === '') {
    if (required) throw ApiError.validation(`${key} is required.`);
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw ApiError.validation(`${key} must be ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
  }
  return value;
}

/** Biến JSON từ form thành các cột SQL; trường chỉ dành cho loại kia được đặt về null. */
export function validateSpot(body, kind) {
  const image = text(body, 'image', { required: true, max: 500 });
  if (!image.startsWith('/') && !image.startsWith('https://')) {
    throw ApiError.validation('image must start with / (a file on this site) or https://.');
  }
  const isFood = kind === 'food';

  return {
    kind,
    name: text(body, 'name', { required: true, max: 120 }),
    short_description: text(body, 'shortDescription', { required: true, max: 300 }),
    description: text(body, 'description', { required: true, max: 3000 }),
    category: text(body, 'category', { required: true, max: 80 }),
    district: text(body, 'district', { required: true, max: 80 }),
    price_level: isFood ? number(body, 'priceLevel', { min: 1, max: 3, integer: true, required: true }) : null,
    admission: isFood ? null : number(body, 'admission', { min: 0, max: 100_000_000, integer: true, required: true }),
    rating: number(body, 'rating', { min: 0, max: 5 }),
    duration_minutes: isFood ? null : number(body, 'durationMinutes', { min: 1, max: 1440, integer: true, required: true }),
    image_url: image,
    lat: isFood ? null : number(body, 'lat', { min: -90, max: 90 }),
    lng: isFood ? null : number(body, 'lng', { min: -180, max: 180 }),
    address: text(body, 'address', { max: 300 }),
    opening_hours: text(body, 'openingHours', { max: 200 }),
    local_tip: text(body, 'localTip', { max: 500 }),
    featured: body.featured === true || body.featured === 1 ? 1 : 0,
  };
}

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function uniqueSpotId(kind, name) {
  const base = `${kind === 'food' ? 'food' : 'place'}-${slugify(name) || 'item'}`;
  const taken = (id) => getDb().prepare('SELECT 1 FROM spots WHERE id = ?').get(id);
  let id = base;
  for (let n = 2; taken(id); n += 1) id = `${base}-${n}`;
  return id;
}

const COLUMNS = [
  'kind', 'name', 'short_description', 'description', 'category', 'district', 'price_level', 'admission',
  'rating', 'duration_minutes', 'image_url', 'lat', 'lng', 'address', 'opening_hours', 'local_tip', 'featured',
];

export function createSpot(body) {
  const kind = body?.kind;
  if (!SPOT_KINDS.includes(kind)) throw ApiError.validation(`kind must be one of: ${SPOT_KINDS.join(', ')}.`);
  const row = validateSpot(body, kind);
  const id = uniqueSpotId(kind, row.name);

  getDb()
    .prepare(`INSERT INTO spots (id, ${COLUMNS.join(', ')}) VALUES (?, ${COLUMNS.map(() => '?').join(', ')})`)
    .run(id, ...COLUMNS.map((column) => row[column]));
  return getSpotById(id);
}

/** Loại (kind) không đổi được sau khi tạo vì id, ảnh và quán đi kèm theo loại. */
export function updateSpot(id, body) {
  const existing = getSpotById(id);
  if (!existing) throw ApiError.notFound(`No spot found with id "${id}".`);
  const row = validateSpot(body ?? {}, existing.kind);

  getDb()
    .prepare(`UPDATE spots SET ${COLUMNS.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`)
    .run(...COLUMNS.map((column) => row[column]), id);
  return getSpotById(id);
}

export function deleteSpot(id) {
  const result = getDb().prepare('DELETE FROM spots WHERE id = ?').run(id);
  if (result.changes === 0) throw ApiError.notFound(`No spot found with id "${id}".`);
}
