/**
 * Creates the database from schema.sql.
 *
 *   npm run db:init            apply the schema (safe to re-run)
 *   npm run db:init -- --fresh delete the database file first
 */
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { getDb, closeDb } from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Deleting the database file while the server is running is a trap: the server
 * keeps writing to the unlinked file, so it appears to work while every other
 * process reads an empty database. Refuse instead of failing silently.
 */
async function assertServerNotRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${config.port}/api/health`, {
      signal: AbortSignal.timeout(400),
    });
    if (response.ok) {
      console.error(
        `[db] A server is already running on port ${config.port} and is holding the database.\n` +
          `     Stop it first, then run this again. The server would otherwise keep writing to\n` +
          `     the deleted file and every other process would see an empty database.`
      );
      process.exit(1);
    }
  } catch {
    // Nothing listening, or it did not answer in time. Safe to continue.
  }
}

export function initDatabase({ fresh = false } = {}) {
  if (fresh) {
    closeDb();
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      rmSync(`${config.databasePath}${suffix}`, { force: true });
    }
  }

  const schema = readFileSync(path.join(here, 'schema.sql'), 'utf8');
  const db = getDb();
  db.exec(schema);
  return db;
}

// Only run when executed directly, not when imported by the server.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fresh = process.argv.includes('--fresh');
  if (fresh) await assertServerNotRunning();
  initDatabase({ fresh });
  console.log(`[db] Schema applied${fresh ? ' to a fresh database' : ''}: ${config.databasePath}`);
  closeDb();
}
