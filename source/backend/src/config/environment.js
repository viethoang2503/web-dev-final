/**
 * CẤU HÌNH: đọc .env nếu có, rồi dùng giá trị mặc định cho cổng và đường dẫn.
 * import.meta.url chỉ vị trí file hiện tại; từ đó suy ra gốc project, không phụ thuộc nơi gõ npm start.
 */
/** Đọc cấu hình ở gốc dự án; chạy được ngay cả khi chưa tạo .env. */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(configDir, '../../../..');

const envFile = path.join(projectRoot, '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const rawDatabasePath = process.env.DATABASE_PATH ?? './source/backend/data/hanoi-local.sqlite';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  // Đường dẫn tính từ gốc dự án, không phụ thuộc thư mục chạy lệnh.
  databasePath: path.resolve(projectRoot, rawDatabasePath),
  // Đăng nhập Google: Client ID lấy từ Google Cloud Console; SESSION_SECRET dùng để ký cookie phiên.
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-only-secret-change-me',
  // Email (cách nhau bằng dấu phẩy) tự động được quyền admin khi đăng ký hoặc đăng nhập.
  adminEmails: (process.env.ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean),
  // Địa chỉ công khai của site, dùng trong URL của mã QR. Để trống thì tự lấy từ yêu cầu (và địa chỉ mạng LAN khi chạy localhost).
  publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/+$/, ''),
  publicDir: path.join(projectRoot, 'source', 'frontend', 'public'),
};
