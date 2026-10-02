-- Bảng catalogue công khai. Favorites và lịch dùng localStorage trong trình duyệt.
-- File SQLite cũ có thể còn bảng tài khoản lịch sử; chạy schema này không xóa dữ liệu đó.

-- Mỗi hàng là một món hoặc địa điểm; PRIMARY KEY giữ id duy nhất.
-- NOT NULL bắt buộc dữ liệu; CHECK chặn giá trị ngoài miền cho phép ngay tại database.
CREATE TABLE IF NOT EXISTS spots (
  id                TEXT PRIMARY KEY,
  kind              TEXT NOT NULL CHECK (kind IN ('food', 'place')),
  name              TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description       TEXT NOT NULL,
  category          TEXT NOT NULL,
  district          TEXT NOT NULL,
  -- Chỉ món ăn: 1 = rẻ, 2 = vừa, 3 = cao.
  price_level       INTEGER CHECK (price_level IS NULL OR price_level BETWEEN 1 AND 3),
  -- Chỉ điểm tham quan: vé VND, 0 nghĩa là miễn phí.
  admission         INTEGER CHECK (admission IS NULL OR admission >= 0),
  rating            REAL CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  duration_minutes  INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  image_url         TEXT NOT NULL,
  -- Tọa độ gần đúng của điểm tham quan, dùng để ước tính khoảng cách trong lịch.
  lat               REAL CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  lng               REAL CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  address           TEXT,
  opening_hours     TEXT,
  local_tip         TEXT,
  featured          INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1))
);

-- Chỉ mục hỗ trợ tra cứu theo loại và trạng thái nổi bật, không tạo bản sao danh mục mới.
CREATE INDEX IF NOT EXISTS idx_spots_kind ON spots (kind);
CREATE INDEX IF NOT EXISTS idx_spots_featured ON spots (featured);

-- Tài khoản: đăng ký bằng email + mật khẩu hoặc đăng nhập Google (một tài khoản có thể có cả hai).
-- password_hash rỗng nghĩa là tài khoản chỉ dùng Google. role 'admin' mở trang quản trị.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub    TEXT UNIQUE,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  picture       TEXT,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  -- Gói tài khoản: 'premium' mở thêm tính năng lập lịch; admin cấp trong trang quản trị.
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lịch sử nâng cấp Premium. Thanh toán chỉ là giả lập (method = 'demo'), không có tiền thật.
CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_vnd INTEGER NOT NULL CHECK (amount_vnd >= 0),
  method     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Đơn nâng cấp Premium chờ thanh toán qua QR (giả lập). code là bí mật nằm trong URL của mã QR.
-- expires_at lưu mili giây epoch; trạng thái hết hạn được tính khi đọc nên không cần tác vụ nền.
CREATE TABLE IF NOT EXISTS payment_orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE,
  amount_vnd INTEGER NOT NULL CHECK (amount_vnd >= 0),
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at INTEGER NOT NULL,
  paid_at    TEXT
);
