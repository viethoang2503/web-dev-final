/**
 * Hanoi Local application entry point.
 *
 * Static frontend and JSON API are served from the same origin, so the browser
 * never deals with CORS and the demo works offline.
 */
import express from 'express';
import session from 'express-session';
import { config } from './config/environment.js';
import { apiRouter } from './routes/api.routes.js';
import { apiNotFound, errorHandler } from './middleware/error-handler.middleware.js';
import { resolveImage } from './middleware/image-resolver.middleware.js';
import { initDatabase } from './database/initialize.js';
import { SqliteSessionStore } from './database/sqlite-session.store.js';

// Make sure the tables exist before the first request arrives.
initDatabase();

if (config.isProduction && config.sessionSecret === config.defaultSessionSecret) {
  // Refuse to run with the shared development secret in production: anyone who
  // knows it could forge a session cookie.
  console.error('[server] SESSION_SECRET must be set in production. Refusing to start.');
  process.exit(1);
}

const app = express();

app.disable('x-powered-by');
// Needed for secure cookies when something sits in front of the app.
if (config.isProduction) app.set('trust proxy', 1);

app.use(express.json({ limit: '32kb' }));

app.use(
  session({
    name: 'hanoi.sid',
    secret: config.sessionSecret,
    store: new SqliteSessionStore({ ttlMs: config.sessionTtlMs }),
    // Do not write a session row for guests who never sign in.
    resave: false,
    saveUninitialized: false,
    // Refresh the expiry while someone is active.
    rolling: true,
    cookie: {
      httpOnly: true, // JavaScript cannot read the cookie
      sameSite: 'lax', // sent on normal navigation, not on cross-site posts
      secure: config.isProduction, // HTTPS only once deployed
      maxAge: config.sessionTtlMs,
      path: '/',
    },
  })
);

// API first, so a stray file in public/ can never shadow an endpoint.
app.use('/api', apiRouter);
app.use('/api', apiNotFound);

// Extensionless image paths resolve to whichever format exists on disk.
app.use(resolveImage);

app.use(
  express.static(config.publicDir, {
    extensions: ['html'],
    maxAge: config.isProduction ? '1h' : 0,
  })
);

app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[server] Hanoi Local running at http://localhost:${config.port}`);
  console.log(`[server] Database: ${config.databasePath}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
