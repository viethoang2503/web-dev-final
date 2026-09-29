-- Bảng catalogue công khai. Favorites và lịch dùng localStorage trong trình duyệt.
-- File SQLite cũ có thể còn bảng tài khoản lịch sử; chạy schema này không xóa dữ liệu đó.

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
  address           TEXT,
  opening_hours     TEXT,
  local_tip         TEXT,
  featured          INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_spots_kind ON spots (kind);
CREATE INDEX IF NOT EXISTS idx_spots_featured ON spots (featured);
