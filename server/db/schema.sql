-- Hanoi Local database schema (Technical Spec section 4).
-- Foreign-key enforcement is enabled per connection in server/db/index.js.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spots (
  id                TEXT PRIMARY KEY,
  kind              TEXT NOT NULL CHECK (kind IN ('food', 'place')),
  name              TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description       TEXT NOT NULL,
  category          TEXT NOT NULL,
  district          TEXT NOT NULL,
  -- Food only: 1 = budget, 2 = mid, 3 = higher.
  price_level       INTEGER CHECK (price_level IS NULL OR price_level BETWEEN 1 AND 3),
  -- Place only: admission fee in VND. 0 means free entry.
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

CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  spot_id    TEXT NOT NULL REFERENCES spots (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Composite key is what makes a duplicate Favorite impossible (F4).
  PRIMARY KEY (user_id, spot_id)
);

CREATE TABLE IF NOT EXISTS itinerary_items (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  spot_id   TEXT NOT NULL REFERENCES spots (id) ON DELETE CASCADE,
  time_slot TEXT NOT NULL CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
  position  INTEGER NOT NULL,
  -- One spot can only appear once in a user's day (F5).
  UNIQUE (user_id, spot_id)
);

CREATE INDEX IF NOT EXISTS idx_itinerary_user_slot
  ON itinerary_items (user_id, time_slot, position);

-- Sessions live in the database rather than in server memory, so a restart
-- does not sign everybody out. Written and read by server/db/session-store.js.
CREATE TABLE IF NOT EXISTS sessions (
  sid     TEXT PRIMARY KEY,
  -- express-session gives us the session as JSON; we store it as text.
  data    TEXT NOT NULL,
  -- Expiry as epoch milliseconds, so comparing is a plain integer compare.
  expires INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires);
