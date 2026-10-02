/**
 * KHỞI TẠO CẤU TRÚC: đọc schema.sql để tạo bảng/chỉ mục còn thiếu, bổ sung tọa độ cho DB cũ.
 * Khởi động server chỉ tạo cấu trúc; muốn có dữ liệu mẫu cần chạy db:seed.
 * Nhánh fresh xóa file database và file phụ; chỉ dùng khi chủ động muốn tạo lại dữ liệu.
 */
/**
 * npm run db:init áp dụng schema và có thể chạy lại.
 * npm run db:init -- --fresh xóa database trước khi tạo mới.
 */
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/environment.js';
import { getDb, closeDb } from './connection.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Kiểm tra server trước khi chạy --fresh bằng dòng lệnh.
 * Nếu server còn giữ kết nối với file cũ thì không xóa, tránh các tiến trình nhìn thấy dữ liệu khác nhau.
 */
async function assertServerNotRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${config.port}/api/health`, {
      signal: AbortSignal.timeout(400),
    });
    if (response.ok) {
      console.error(
        `[db] A server is already running on port ${config.port} and is holding the database.\n` +
          `     Stop it first, then run this again. The server would otherwise keep writing to\n` +
          `     the deleted file and every other process would see an empty database.`
      );
      process.exit(1);
    }
  } catch {
    // Không nhận được phản hồi thành công trong thời gian chờ; tiếp tục nhánh tạo mới.
  }
}

/** CREATE TABLE IF NOT EXISTS không thêm cột mới vào file SQLite cũ, nên bổ sung ở đây. */
function addMissingColumns(db) {
  const existing = new Set(db.prepare('PRAGMA table_info(spots)').all().map((column) => column.name));
  for (const column of ['lat', 'lng']) {
    if (!existing.has(column)) db.exec(`ALTER TABLE spots ADD COLUMN ${column} REAL`);
  }

  const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map((column) => column.name));
  if (!userColumns.has('plan')) {
    db.exec("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium'))");
  }
}

/**
 * Bảng users bản đầu chỉ có Google (google_sub NOT NULL). SQLite không đổi được ràng buộc cột,
 * nên đổi tên bảng cũ trước khi schema.sql tạo bảng mới, rồi chép dữ liệu sang.
 */
function renameLegacyUsers(db) {
  const columns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
  if (columns.length > 0 && !columns.includes('password_hash')) {
    db.exec('ALTER TABLE users RENAME TO users_legacy');
  }
}

function copyLegacyUsers(db) {
  const legacy = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users_legacy'").get();
  if (!legacy) return;
  db.exec(`INSERT INTO users (id, google_sub, email, name, picture, created_at)
           SELECT id, google_sub, email, name, picture, created_at FROM users_legacy`);
  db.exec('DROP TABLE users_legacy');
}

export function initDatabase({ fresh = false } = {}) {
  if (fresh) {
    closeDb();
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      rmSync(`${config.databasePath}${suffix}`, { force: true });
    }
  }

  const schema = readFileSync(path.join(here, 'schema.sql'), 'utf8');
  const db = getDb();
  renameLegacyUsers(db);
  db.exec(schema);
  copyLegacyUsers(db);
  addMissingColumns(db);
  return db;
}

// Chỉ chạy khối lệnh này khi gọi file trực tiếp; import từ server không chạy khối này.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fresh = process.argv.includes('--fresh');
  if (fresh) await assertServerNotRunning();
  initDatabase({ fresh });
  console.log(`[db] Schema applied${fresh ? ' to a fresh database' : ''}: ${config.databasePath}`);
  closeDb();
}
