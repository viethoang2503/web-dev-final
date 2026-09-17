/**
 * SQLite session store for express-session.
 *
 * Why hand-written instead of a package: the default MemoryStore signs every
 * user out when the server restarts and warns that it is not meant for real
 * use, while the SQLite store packages pull in a native module. The store
 * interface is small, and the database is already open, so this is ~60 lines
 * and one more thing the team can explain during the demo.
 *
 * Contract expected by express-session:
 *   get(sid, cb)      -> cb(null, session | null)
 *   set(sid, s, cb)   -> cb(null)
 *   destroy(sid, cb)  -> cb(null)
 *   touch(sid, s, cb) -> cb(null)          extends the expiry on activity
 *   length(cb), clear(cb), all(cb)         used by tooling, cheap to provide
 *
 * Errors are passed to the callback; express-session turns them into a 500
 * through our central error middleware.
 */
import session from 'express-session';
import { getDb } from './index.js';

const HOUR = 60 * 60 * 1000;

export class SqliteSessionStore extends session.Store {
  /**
   * @param {{ ttlMs?: number, pruneIntervalMs?: number }} [options]
   *        ttlMs: fallback lifetime when a session has no cookie expiry
   */
  constructor({ ttlMs = 24 * HOUR * 7, pruneIntervalMs = HOUR } = {}) {
    super();
    this.ttlMs = ttlMs;
    this.db = getDb();

    this.statements = {
      get: this.db.prepare('SELECT data, expires FROM sessions WHERE sid = ?'),
      upsert: this.db.prepare(`
        INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?)
        ON CONFLICT (sid) DO UPDATE SET data = excluded.data, expires = excluded.expires
      `),
      touch: this.db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?'),
      destroy: this.db.prepare('DELETE FROM sessions WHERE sid = ?'),
      count: this.db.prepare('SELECT COUNT(*) AS total FROM sessions WHERE expires > ?'),
      all: this.db.prepare('SELECT sid, data FROM sessions WHERE expires > ?'),
      clear: this.db.prepare('DELETE FROM sessions'),
      prune: this.db.prepare('DELETE FROM sessions WHERE expires <= ?'),
    };

    // Clear out anything already expired, then keep doing it while we run.
    this.prune();
    this.pruneTimer = setInterval(() => this.prune(), pruneIntervalMs);
    // Do not hold the event loop open just for the cleanup timer.
    this.pruneTimer.unref?.();
  }

  /** Expiry for a session: the cookie's own expiry, or now + ttl. */
  #expiryFor(sessionData) {
    const cookieExpiry = sessionData?.cookie?.expires;
    if (cookieExpiry) {
      return new Date(cookieExpiry).getTime();
    }
    return Date.now() + this.ttlMs;
  }

  get(sid, callback) {
    try {
      const row = this.statements.get.get(sid);

      if (!row) {
        return callback(null, null);
      }

      // Expired but not yet pruned: treat as absent and clean it up.
      if (row.expires <= Date.now()) {
        this.statements.destroy.run(sid);
        return callback(null, null);
      }

      return callback(null, JSON.parse(row.data));
    } catch (error) {
      return callback(error);
    }
  }

  set(sid, sessionData, callback) {
    try {
      this.statements.upsert.run(sid, JSON.stringify(sessionData), this.#expiryFor(sessionData));
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  /** Called on every request for an active session when rolling is enabled. */
  touch(sid, sessionData, callback) {
    try {
      this.statements.touch.run(this.#expiryFor(sessionData), sid);
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  destroy(sid, callback) {
    try {
      this.statements.destroy.run(sid);
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  length(callback) {
    try {
      return callback(null, this.statements.count.get(Date.now()).total);
    } catch (error) {
      return callback(error);
    }
  }

  all(callback) {
    try {
      const sessions = this.statements.all
        .all(Date.now())
        .map((row) => ({ sid: row.sid, ...JSON.parse(row.data) }));
      return callback(null, sessions);
    } catch (error) {
      return callback(error);
    }
  }

  clear(callback) {
    try {
      this.statements.clear.run();
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  /** Delete expired rows. Returns how many were removed. */
  prune() {
    try {
      return this.statements.prune.run(Date.now()).changes;
    } catch (error) {
      console.error('[session] Could not prune expired sessions', error);
      return 0;
    }
  }
}
