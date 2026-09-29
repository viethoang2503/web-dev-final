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
  publicDir: path.join(projectRoot, 'source', 'frontend', 'public'),
};
