/**
 * favorites.service.js - saved spots per user (FAV-01).
 *
 * Every function takes userId as its first argument, and that value always
 * comes from the session. Nothing here trusts an id from the browser.
 *
 * Duplicates are impossible because favorites has PRIMARY KEY (user_id,
 * spot_id); the code relies on that constraint instead of checking first.
 */
import { getDb } from '../db/index.js';
import { ApiError } from './respond.js';
import { getSpotById } from './spots.service.js';

/**
 * A user's favorites, newest first, with the full spot record attached so the
 * drawer can render cards without extra requests.
 */
export function listFavorites(userId) {
  const db = getDb();
  const rows = db
    .prepare('SELECT spot_id, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC, spot_id')
    .all(userId);

  return rows
    .map((row) => {
      const spot = getSpotById(row.spot_id);
      return spot ? { ...spot, savedAt: row.created_at } : null;
    })
    .filter(Boolean);
}

/** Just the ids, for syncing heart buttons on a page. */
export function listFavoriteIds(userId) {
  const db = getDb();
  return db
    .prepare('SELECT spot_id FROM favorites WHERE user_id = ?')
    .all(userId)
    .map((row) => row.spot_id);
}

/**
 * Save a spot.
 *
 * Adding something already saved is treated as success rather than an error:
 * the user's intent ("this should be saved") is satisfied either way, and two
 * quick clicks should not produce a scary message. The database still refuses
 * to create a second row.
 *
 * @returns {{ spot: object, created: boolean }}
 * @throws {ApiError} NOT_FOUND when the spot id does not exist
 */
export function addFavorite(userId, spotId) {
  const spot = getSpotById(spotId);
  if (!spot) {
    throw ApiError.notFound(`No spot found with id "${spotId}".`);
  }

  const db = getDb();
  const result = db
    .prepare('INSERT OR IGNORE INTO favorites (user_id, spot_id) VALUES (?, ?)')
    .run(userId, spotId);

  return { spot, created: result.changes === 1 };
}

/**
 * Remove a saved spot.
 *
 * @returns {boolean} whether a row was actually removed
 */
export function removeFavorite(userId, spotId) {
  const db = getDb();
  const result = db
    .prepare('DELETE FROM favorites WHERE user_id = ? AND spot_id = ?')
    .run(userId, spotId);

  return result.changes === 1;
}

export function countFavorites(userId) {
  const db = getDb();
  return db.prepare('SELECT COUNT(*) AS total FROM favorites WHERE user_id = ?').get(userId).total;
}
