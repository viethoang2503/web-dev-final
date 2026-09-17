/**
 * Single SQLite connection for the whole app.
 *
 * Uses Node's built-in node:sqlite module, so there is no native module to
 * compile and `npm install` works the same on every member's machine.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

let database;

/** Open (and lazily create) the database file with the project's pragmas. */
export function getDb() {
  if (database) {
    return database;
  }

  mkdirSync(path.dirname(config.databasePath), { recursive: true });
  database = new DatabaseSync(config.databasePath);

  // Foreign keys are off by default in SQLite and must be enabled per connection.
  database.exec('PRAGMA foreign_keys = ON');
  // Better concurrent read behaviour, which matters for the benchmark task.
  database.exec('PRAGMA journal_mode = WAL');

  return database;
}

/**
 * node:sqlite returns rows with a null prototype. Copying into plain objects
 * keeps them predictable for the rest of the codebase.
 */
export function toPlain(row) {
  return row ? { ...row } : row;
}

export function closeDb() {
  if (database) {
    database.close();
    database = undefined;
  }
}
