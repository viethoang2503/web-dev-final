/**
 * itinerary.service.js - the one-day plan per user (DAY-01).
 *
 * Model: itinerary_items rows, each with a time_slot and a position inside
 * that slot. Positions are always the dense sequence 0..n-1 per slot, which is
 * what makes "move up" a swap and keeps the order stable after a reload.
 *
 * UNIQUE(user_id, spot_id) means one spot can appear in a day only once. That
 * rule lives in the schema, not in these functions.
 */
import { getDb } from '../db/index.js';
import { ApiError } from './respond.js';
import { getSpotById } from './spots.service.js';
import { estimateSpotCost, estimateTotals } from './pricing.js';

export const TIME_SLOTS = ['morning', 'afternoon', 'evening'];

/** Throws unless the value is one of the three slots. */
export function assertTimeSlot(value) {
  if (!TIME_SLOTS.includes(value)) {
    throw ApiError.validation(`timeSlot must be one of: ${TIME_SLOTS.join(', ')}.`, {
      timeSlot: 'Choose morning, afternoon or evening.',
    });
  }
  return value;
}

/** Rows for one user, ordered the way the drawer displays them. */
function readItems(userId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, spot_id, time_slot, position
         FROM itinerary_items
        WHERE user_id = ?
        ORDER BY CASE time_slot
                   WHEN 'morning' THEN 0
                   WHEN 'afternoon' THEN 1
                   ELSE 2
                 END,
                 position`
    )
    .all(userId);
}

/**
 * The full plan, grouped by slot, with spot data and totals attached.
 *
 * @returns {{ items: object[], slots: object, totals: object }}
 */
export function getItinerary(userId) {
  const items = readItems(userId)
    .map((row) => {
      const spot = getSpotById(row.spot_id);
      if (!spot) return null; // spot removed from the catalogue
      const { amount, exact } = estimateSpotCost(spot);
      return {
        id: row.id,
        timeSlot: row.time_slot,
        position: row.position,
        estimatedCostVnd: amount,
        costIsExact: exact,
        spot,
      };
    })
    .filter(Boolean);

  const slots = Object.fromEntries(
    TIME_SLOTS.map((slot) => [slot, items.filter((item) => item.timeSlot === slot)])
  );

  const totals = estimateTotals(items.map((item) => item.spot));

  return {
    items,
    slots,
    totals: {
      ...totals,
      durationMinutes: items.reduce((sum, item) => sum + (item.spot.durationMinutes ?? 0), 0),
      perSlot: Object.fromEntries(TIME_SLOTS.map((slot) => [slot, slots[slot].length])),
    },
  };
}

/** Next free position at the end of a slot. */
function nextPosition(db, userId, timeSlot) {
  const row = db
    .prepare('SELECT MAX(position) AS maxPosition FROM itinerary_items WHERE user_id = ? AND time_slot = ?')
    .get(userId, timeSlot);
  return (row.maxPosition ?? -1) + 1;
}

/**
 * Add a spot to a slot, at the end.
 *
 * @throws {ApiError} NOT_FOUND unknown spot, CONFLICT spot already in the day
 */
export function addItem(userId, { spotId, timeSlot }) {
  assertTimeSlot(timeSlot);

  const spot = getSpotById(spotId);
  if (!spot) {
    throw ApiError.notFound(`No spot found with id "${spotId}".`);
  }

  const db = getDb();

  try {
    const result = db
      .prepare(
        'INSERT INTO itinerary_items (user_id, spot_id, time_slot, position) VALUES (?, ?, ?, ?)'
      )
      .run(userId, spotId, timeSlot, nextPosition(db, userId, timeSlot));

    return { id: Number(result.lastInsertRowid), spot, timeSlot };
  } catch (error) {
    if (String(error?.message ?? '').includes('UNIQUE constraint failed')) {
      throw ApiError.conflict(`${spot.name} is already in your day.`);
    }
    throw error;
  }
}

/** Read one item and prove it belongs to this user. */
function readOwnedItem(db, userId, itemId) {
  const item = db
    .prepare('SELECT id, spot_id, time_slot, position FROM itinerary_items WHERE id = ? AND user_id = ?')
    .get(itemId, userId);

  // 404 rather than 403: a user should not be able to tell whether an id
  // belongs to somebody else.
  if (!item) {
    throw ApiError.notFound('That itinerary item does not exist.');
  }

  return item;
}

/** Rewrite positions in one slot so they are 0..n-1 with no gaps. */
function renumber(db, userId, timeSlot) {
  const rows = db
    .prepare('SELECT id FROM itinerary_items WHERE user_id = ? AND time_slot = ? ORDER BY position, id')
    .all(userId, timeSlot);

  const update = db.prepare('UPDATE itinerary_items SET position = ? WHERE id = ?');
  rows.forEach((row, index) => update.run(index, row.id));
}

/**
 * Move an item to another slot and/or another position (DAY-05).
 *
 * @param {{ timeSlot?: string, position?: number }} changes
 *        position is clamped into the target slot's range, so "move up" at the
 *        top is a no-op instead of an error.
 */
export function moveItem(userId, itemId, changes = {}) {
  const db = getDb();
  const item = readOwnedItem(db, userId, itemId);

  const targetSlot = changes.timeSlot === undefined ? item.time_slot : assertTimeSlot(changes.timeSlot);

  if (changes.position !== undefined && !Number.isInteger(Number(changes.position))) {
    throw ApiError.validation('position must be a whole number.', {
      position: 'Use a whole number.',
    });
  }

  db.exec('BEGIN');
  try {
    // Park the row far out of the way so the remaining items can close ranks
    // without colliding with it.
    db.prepare('UPDATE itinerary_items SET time_slot = ?, position = ? WHERE id = ?').run(
      targetSlot,
      Number.MAX_SAFE_INTEGER,
      item.id
    );

    if (targetSlot !== item.time_slot) {
      renumber(db, userId, item.time_slot);
    }

    const siblings = db
      .prepare(
        'SELECT id FROM itinerary_items WHERE user_id = ? AND time_slot = ? AND id != ? ORDER BY position, id'
      )
      .all(userId, targetSlot, item.id)
      .map((row) => row.id);

    const requested = changes.position === undefined ? siblings.length : Number(changes.position);
    const index = Math.min(Math.max(requested, 0), siblings.length);

    const ordered = [...siblings.slice(0, index), item.id, ...siblings.slice(index)];
    const update = db.prepare('UPDATE itinerary_items SET position = ? WHERE id = ?');
    ordered.forEach((id, position) => update.run(position, id));

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return readOwnedItem(db, userId, itemId);
}

/** Remove one item and close the gap it leaves. */
export function removeItem(userId, itemId) {
  const db = getDb();
  const item = readOwnedItem(db, userId, itemId);

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM itinerary_items WHERE id = ? AND user_id = ?').run(itemId, userId);
    renumber(db, userId, item.time_slot);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { id: Number(itemId), timeSlot: item.time_slot };
}

/** Clear the whole day. The route requires an explicit confirmation flag. */
export function resetItinerary(userId) {
  const db = getDb();
  const result = db.prepare('DELETE FROM itinerary_items WHERE user_id = ?').run(userId);
  return { removed: result.changes };
}
