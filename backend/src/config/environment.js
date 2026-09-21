/**
 * Central configuration.
 *
 * Reads .env when present (Node's built-in loader, no extra dependency) and
 * falls back to the documented defaults from .env.example so a fresh clone
 * runs without any manual setup.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(configDir, '../../..');

const envFile = path.join(projectRoot, '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const rawDatabasePath = process.env.DATABASE_PATH ?? './backend/data/hanoi-local.sqlite';

/**
 * Fallback secret so a fresh clone runs without setup. backend/src/server.js refuses to
 * start with this value when NODE_ENV=production.
 */
const DEFAULT_SESSION_SECRET = 'dev-only-insecure-secret';

const DAY_MS = 24 * 60 * 60 * 1000;

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  // Resolved so the app behaves the same no matter where npm start is run from.
  databasePath: path.resolve(projectRoot, rawDatabasePath),
  publicDir: path.join(projectRoot, 'frontend', 'public'),
  sessionSecret: process.env.SESSION_SECRET ?? DEFAULT_SESSION_SECRET,
  defaultSessionSecret: DEFAULT_SESSION_SECRET,
  // How long a signed-in session stays valid without activity.
  sessionTtlMs: Number(process.env.SESSION_TTL_DAYS ?? 7) * DAY_MS,
};
