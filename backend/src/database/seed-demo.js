/**
 * Demo accounts for the presentation (docs/05 section 10).
 *
 *   npm run db:demo
 *
 * Creates two accounts with data already in them, so the demo does not have to
 * start from an empty state, and so "two users have separate data" can be shown
 * by logging in twice instead of registering twice on stage.
 *
 * Safe to re-run: each account is rebuilt from scratch, and no other user is
 * touched. The passwords are printed once here on purpose; they are throwaway
 * demo credentials, not secrets, and docs/05 asks for them to be recorded.
 */
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { config } from '../config/environment.js';
import { getDb, closeDb } from './connection.js';
import { initDatabase } from './initialize.js';
import { seedDatabase } from './seed.js';

/**
 * The demo password is committed on purpose, because docs/05 asks for known
 * credentials the presenters can rely on, and these accounts only ever exist in
 * a local database. Two guards keep that from becoming a real weakness:
 *
 * 1. this script refuses to run when NODE_ENV=production, so a deployed
 *    instance never gets a known-password account;
 * 2. DEMO_PASSWORD overrides the default if a different one is wanted.
 */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'hanoi2026';

/**
 * Two contrasting plans, so the difference between accounts is obvious on
 * screen: one food-led day in the Old Quarter, one heritage-led day.
 */
const DEMO_ACCOUNTS = [
  {
    username: 'demo',
    password: DEMO_PASSWORD,
    label: 'Main presenter account',
    favorites: ['food-pho-bo', 'food-bun-cha', 'place-hoan-kiem-lake', 'place-temple-of-literature'],
    itinerary: [
      { spotId: 'food-pho-bo', timeSlot: 'morning' },
      { spotId: 'place-hoan-kiem-lake', timeSlot: 'morning' },
      { spotId: 'place-temple-of-literature', timeSlot: 'afternoon' },
      { spotId: 'food-ca-phe-trung', timeSlot: 'afternoon' },
      { spotId: 'food-bun-cha', timeSlot: 'evening' },
    ],
  },
  {
    username: 'demo2',
    password: DEMO_PASSWORD,
    label: 'Second account, proves data is per user',
    favorites: ['food-cha-ca', 'place-museum-of-ethnology'],
    itinerary: [
      { spotId: 'food-banh-cuon', timeSlot: 'morning' },
      { spotId: 'place-museum-of-ethnology', timeSlot: 'afternoon' },
      { spotId: 'food-cha-ca', timeSlot: 'evening' },
    ],
  },
];

const BCRYPT_ROUNDS = 10;

async function seedDemoAccounts() {
  if (config.isProduction) {
    throw new Error(
      'Refusing to create demo accounts with a known password in production. ' +
        'These accounts are for local presentation only.'
    );
  }

  initDatabase();
  // Demo plans reference spot ids, so the catalogue has to be there first.
  seedDatabase();

  const db = getDb();
  db.exec('PRAGMA foreign_keys = ON');

  const created = [];

  for (const account of DEMO_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, BCRYPT_ROUNDS);

    db.exec('BEGIN');
    try {
      // Rebuild from scratch: ON DELETE CASCADE clears the old favorites and
      // itinerary rows, so re-running never doubles anything up.
      db.prepare('DELETE FROM users WHERE username = ?').run(account.username);

      const result = db
        .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
        .run(account.username, passwordHash);
      const userId = result.lastInsertRowid;

      const addFavorite = db.prepare('INSERT INTO favorites (user_id, spot_id) VALUES (?, ?)');
      for (const spotId of account.favorites) {
        addFavorite.run(userId, spotId);
      }

      // Positions are assigned per slot, matching what the app itself writes.
      const positions = { morning: 0, afternoon: 0, evening: 0 };
      const addItem = db.prepare(
        'INSERT INTO itinerary_items (user_id, spot_id, time_slot, position) VALUES (?, ?, ?, ?)'
      );
      for (const item of account.itinerary) {
        addItem.run(userId, item.spotId, item.timeSlot, positions[item.timeSlot]);
        positions[item.timeSlot] += 1;
      }

      db.exec('COMMIT');
      created.push({ ...account, userId: Number(userId) });
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return created;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const accounts = await seedDemoAccounts();

  console.log('[db] Demo accounts ready:\n');
  for (const account of accounts) {
    console.log(`  ${account.username} / ${account.password}`);
    console.log(`    ${account.label}`);
    console.log(
      `    ${account.favorites.length} favorites, ${account.itinerary.length} stops in My Day\n`
    );
  }
  console.log('[db] These are throwaway demo credentials. Do not reuse them anywhere real.');

  closeDb();
}

export { seedDemoAccounts, DEMO_ACCOUNTS };
