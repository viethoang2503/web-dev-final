/** Đọc bảng spots; đổi tên cột SQL thành JSON mà frontend sử dụng. */
import { getDb } from '../database/connection.js';
import { FOOD_VENUES } from '../data/food-venues.js';

export const SPOT_KINDS = ['food', 'place'];

const SELECT_COLUMNS = `
  id, kind, name, short_description, description, category, district,
  price_level, admission, rating, duration_minutes, image_url,
  address, opening_hours, local_tip, featured
`;

/** Database row -> public JSON shape. Null optional fields are dropped. */
function toSpot(row) {
  const spot = {
    id: row.id,
    kind: row.kind,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    category: row.category,
    district: row.district,
    rating: row.rating,
    image: row.image_url,
    address: row.address,
    openingHours: row.opening_hours,
    localTip: row.local_tip,
    featured: row.featured === 1,
  };

  // Kind-specific fields, so a Food card never has to handle admission.
  if (row.kind === 'food') {
    spot.priceLevel = row.price_level;
    // Một món có nhiều quán để người dùng tự chọn và so khoảng cách ước tính.
    spot.venues = FOOD_VENUES[row.id] ?? [];
  } else {
    spot.admission = row.admission;
    spot.isFree = row.admission === 0;
    spot.durationMinutes = row.duration_minutes;
  }

  return spot;
}

/**
 * List spots, newest ordering rule: featured first, then rating, then name.
 * That is the "recommended" sort the frontend starts from.
 *
 * @param {{ kind?: string }} [filters]
 */
export function listSpots({ kind } = {}) {
  const db = getDb();
  const where = kind ? 'WHERE kind = ?' : '';
  const params = kind ? [kind] : [];

  const rows = db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
         FROM spots
         ${where}
     ORDER BY featured DESC, rating DESC, name ASC`
    )
    .all(...params);

  return rows.map(toSpot);
}

/** One spot by id, or undefined when it does not exist. */
export function getSpotById(id) {
  const db = getDb();
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM spots WHERE id = ?`).get(id);
  return row ? toSpot(row) : undefined;
}

/** Distinct filter values per kind, so filter controls are data-driven. */
export function getFilterOptions(kind) {
  const db = getDb();
  const where = kind ? 'WHERE kind = ?' : '';
  const params = kind ? [kind] : [];

  const read = (column) =>
    db
      .prepare(`SELECT DISTINCT ${column} AS value FROM spots ${where} ORDER BY value ASC`)
      .all(...params)
      .map((row) => row.value)
      .filter((value) => value !== null);

  return { categories: read('category'), districts: read('district') };
}
