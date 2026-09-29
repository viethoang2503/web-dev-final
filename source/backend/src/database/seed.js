/**
 * Repeatable seed script (SET-05).
 *
 *   npm run db:seed
 *
 * Upsert theo spots.id: chạy lại không nhân đôi món/địa điểm.
 */
import { fileURLToPath } from 'node:url';
import { getDb, closeDb } from './connection.js';
import { initDatabase } from './initialize.js';
import { spots, seedSummary } from './seed-data.js';

const UPSERT_SPOT = `
  INSERT INTO spots (
    id, kind, name, short_description, description, category, district,
    price_level, admission, rating, duration_minutes, image_url, lat, lng,
    address, opening_hours, local_tip, featured
  ) VALUES (
    :id, :kind, :name, :short_description, :description, :category, :district,
    :price_level, :admission, :rating, :duration_minutes, :image_url, :lat, :lng,
    :address, :opening_hours, :local_tip, :featured
  )
  ON CONFLICT (id) DO UPDATE SET
    kind = excluded.kind,
    name = excluded.name,
    short_description = excluded.short_description,
    description = excluded.description,
    category = excluded.category,
    district = excluded.district,
    price_level = excluded.price_level,
    admission = excluded.admission,
    rating = excluded.rating,
    duration_minutes = excluded.duration_minutes,
    image_url = excluded.image_url,
    lat = excluded.lat,
    lng = excluded.lng,
    address = excluded.address,
    opening_hours = excluded.opening_hours,
    local_tip = excluded.local_tip,
    featured = excluded.featured
`;

/** Map a seed record (camelCase) onto database columns (snake_case). */
function toRow(spot) {
  return {
    id: spot.id,
    kind: spot.kind,
    name: spot.name,
    short_description: spot.shortDescription,
    description: spot.description,
    category: spot.category,
    district: spot.district,
    price_level: spot.priceLevel ?? null,
    admission: spot.admission ?? null,
    rating: spot.rating ?? null,
    duration_minutes: spot.durationMinutes ?? null,
    image_url: spot.image,
    lat: spot.lat ?? null,
    lng: spot.lng ?? null,
    address: spot.address ?? null,
    opening_hours: spot.openingHours ?? null,
    local_tip: spot.localTip ?? null,
    featured: spot.featured ? 1 : 0,
  };
}

export function seedDatabase() {
  initDatabase();
  const db = getDb();
  const statement = db.prepare(UPSERT_SPOT);

  db.exec('BEGIN');
  try {
    for (const spot of spots) {
      statement.run(toRow(spot));
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const counts = db
    .prepare('SELECT kind, COUNT(*) AS total FROM spots GROUP BY kind ORDER BY kind')
    .all();
  return counts.map((row) => ({ ...row }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const counts = seedDatabase();
  const summary = counts.map((row) => `${row.total} ${row.kind}`).join(', ');
  console.log(`[db] Seed complete: ${summary}`);
  console.log(`[db] Districts: ${seedSummary.districts.join(', ')}`);
  console.log(`[db] Food categories: ${seedSummary.foodCategories.join(', ')}`);
  console.log(`[db] Place categories: ${seedSummary.placeCategories.join(', ')}`);
  closeDb();
}
