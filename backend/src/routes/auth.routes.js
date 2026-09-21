/**
 * Authentication endpoints (AUTH-01 to AUTH-05).
 *
 *   POST /api/auth/register   create account + session
 *   POST /api/auth/login      create session
 *   POST /api/auth/logout     destroy session
 *   GET  /api/auth/me         current user, or null for a guest
 *
 * The response never contains password_hash, and a failed login never says
 * whether it was the username or the password that was wrong.
 */
import { Router } from 'express';
import { ApiError, sendObject } from '../utils/http-response.js';
import {
  createUser,
  validateCredentials,
  verifyCredentials,
} from '../services/users.service.js';

export const authRouter = Router();

/**
 * Start a fresh session for a user.
 *
 * regenerate() gives the session a new id, which prevents session fixation:
 * an id an attacker planted before sign-in cannot be reused afterwards.
 */
function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError);

      // Only the id goes in the session. Everything else is read from the
      // database, so a renamed or deleted account cannot linger in a cookie.
      req.session.userId = user.id;

      req.session.save((saveError) => (saveError ? reject(saveError) : resolve()));
    });
  });
}

/* --- AUTH-01, AUTH-02 -------------------------------------------------- */

authRouter.post('/register', async (req, res, next) => {
  try {
    const credentials = validateCredentials(req.body);
    const user = await createUser(credentials);
    await startSession(req, user);
    return sendObject(res, { user }, 201);
  } catch (error) {
    return next(error);
  }
});

/* --- AUTH-03 ----------------------------------------------------------- */

authRouter.post('/login', async (req, res, next) => {
  try {
    const credentials = validateCredentials(req.body, { forLogin: true });
    const user = await verifyCredentials(credentials);

    if (!user) {
      // Deliberately generic: revealing which half was wrong would let someone
      // enumerate usernames.
      throw ApiError.validation('Incorrect username or password.');
    }

    await startSession(req, user);
    return sendObject(res, { user });
  } catch (error) {
    return next(error);
  }
});

/* --- AUTH-05 ----------------------------------------------------------- */

authRouter.post('/logout', (req, res, next) => {
  const finish = () => {
    // Remove the cookie as well, so the browser stops sending a dead id.
    res.clearCookie('hanoi.sid', { httpOnly: true, sameSite: 'lax', path: '/' });
    return sendObject(res, { user: null });
  };

  if (!req.session) return finish();

  return req.session.destroy((error) => (error ? next(error) : finish()));
});

/* --- AUTH-04 ----------------------------------------------------------- */

/**
 * Guests get 200 with user: null rather than 401. The frontend calls this on
 * every page load to decide what the header shows, and a guest browsing the
 * public catalogue is not an error.
 */
authRouter.get('/me', (req, res) => sendObject(res, { user: req.user ?? null }));
