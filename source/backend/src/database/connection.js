/**
 * KẾT NỐI SQLITE: mở file database khi cần lần đầu và dùng lại kết nối cho các truy vấn sau.
 * DatabaseSync là API đồng bộ có sẵn trong Node; thao tác SQL hoàn tất trước khi chạy dòng tiếp theo.
 */
/**
 * Dùng chung một kết nối SQLite cho toàn bộ ứng dụng.
 * Module node:sqlite có sẵn trong Node nên không cần thêm thư viện database bên ngoài.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config/environment.js';

let database;

/** Mở file SQLite khi cần lần đầu và thiết lập các tùy chọn kết nối. */
export function getDb() {
  if (database) {
    return database;
  }

  mkdirSync(path.dirname(config.databasePath), { recursive: true });
  database = new DatabaseSync(config.databasePath);

  // Bật kiểm tra khóa ngoại cho kết nối; hữu ích nếu database có các bảng liên kết.
  database.exec('PRAGMA foreign_keys = ON');
  // Chế độ WAL giúp việc đọc và ghi cùng tồn tại thuận lợi hơn.
  database.exec('PRAGMA journal_mode = WAL');

  return database;
}

/**
 * Hàng dữ liệu từ node:sqlite có prototype null; sao chép thành object thường
 * để các phần khác có thể sử dụng theo cách quen thuộc.
 */
export function toPlain(row) {
  return row ? { ...row } : row;
}

// Đóng kết nối và bỏ biến tham chiếu để lần getDb tiếp theo có thể mở kết nối mới.
export function closeDb() {
  if (database) {
    database.close();
    database = undefined;
  }
}
