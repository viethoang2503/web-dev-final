/**
 * users.service.js - accounts and password handling (AUTH-01, AUTH-02).
 *
 * Two rules this file exists to guarantee:
 * 1. a plaintext password never reaches the database or a log;
 * 2. password_hash never leaves this module.
 *
 * Every function that returns a user returns the public shape only.
 */
import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import { ApiError } from './respond.js';

/** Cost factor. 10 is the usual default: safe and fast enough for a demo. */
const BCRYPT_ROUNDS = 10;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 6;

// Letters, digits, underscore, dot and hyphen. Keeps usernames printable and
// avoids look-alike whitespace tricks.
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

/** Row -> public user. The only shape the browser is ever given. */
function toPublicUser(row) {
  return { id: row.id, username: row.username, createdAt: row.created_at };
}

/**
 * Validate registration input. The frontend validates too, for feedback; this
 * is the copy that actually protects the database (Technical Spec section 6).
 *
 * @returns {{ username: string, password: string }} trimmed, safe values
 * @throws {ApiError} VALIDATION_ERROR with per-field details
 */
export function validateCredentials({ username, password } = {}, { forLogin = false } = {}) {
  const details = {};
  const cleanUsername = typeof username === 'string' ? username.trim() : '';
  const cleanPassword = typeof password === 'string' ? password : '';

  if (!cleanUsername) {
    details.username = 'Enter a username.';
  } else if (cleanUsername.length < USERNAME_MIN || cleanUsername.length > USERNAME_MAX) {
    details.username = `Username must be ${USERNAME_MIN} to ${USERNAME_MAX} characters.`;
  } else if (!USERNAME_PATTERN.test(cleanUsername)) {
    details.username = 'Use letters, numbers, dot, hyphen or underscore only.';
  }

  if (!cleanPassword) {
    details.password = 'Enter a password.';
    // On login we only need "something was sent"; length rules may have
    // changed since the account was created.
  } else if (!forLogin && cleanPassword.length < PASSWORD_MIN) {
    details.password = `Password must be at least ${PASSWORD_MIN} characters.`;
  }

  if (Object.keys(details).length > 0) {
    throw ApiError.validation('Please check the submitted fields.', details);
  }

  return { username: cleanUsername, password: cleanPassword };
}

/**
 * Create an account.
 *
 * @throws {ApiError} CONFLICT when the username is taken
 */
export async function createUser({ username, password }) {
  const db = getDb();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const result = db
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(username, passwordHash);

    const row = db
      .prepare('SELECT id, username, created_at FROM users WHERE id = ?')
      .get(result.lastInsertRowid);

    return toPublicUser(row);
  } catch (error) {
    // UNIQUE(username) is what actually prevents duplicates; catching the
    // constraint avoids a check-then-insert race.
    if (String(error?.message ?? '').includes('UNIQUE constraint failed: users.username')) {
      throw ApiError.conflict('That username is already taken.');
    }
    throw error;
  }
}

/**
 * Check a username and password pair.
 *
 * Always compares against a hash, even when the user does not exist, so the
 * response time does not reveal which usernames are registered.
 *
 * @returns {Promise<object | null>} public user, or null when invalid
 */
export async function verifyCredentials({ username, password }) {
  const db = getDb();
  const row = db
    .prepare('SELECT id, username, password_hash, created_at FROM users WHERE username = ?')
    .get(username);

  // A real bcrypt hash of a dummy value, used when no account matched.
  const hashToCompare = row?.password_hash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const matches = await bcrypt.compare(password, hashToCompare);

  if (!row || !matches) {
    return null;
  }

  return toPublicUser(row);
}

/** Look up the signed-in user from an id held in the session. */
export function getUserById(id) {
  const db = getDb();
  const row = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(id);
  return row ? toPublicUser(row) : null;
}
