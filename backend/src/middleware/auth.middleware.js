/**
 * requireAuth (AUTH-06).
 *
 * One shared gate for every protected route:
 *
 *   requireAuth -> route handler
 *
 * The user id comes from the session cookie, which the browser cannot forge
 * because the session data lives on the server. A user_id sent in a request
 * body or query string is ignored everywhere in this project.
 */
import { ApiError } from '../utils/http-response.js';
import { getUserById } from '../services/users.service.js';

/** Reject guests with 401 and attach the user for the route to use. */
export function requireAuth(req, res, next) {
  const userId = req.session?.userId;

  if (!userId) {
    return next(ApiError.unauthenticated('Please sign in to continue.'));
  }

  const user = getUserById(userId);

  if (!user) {
    // The account was deleted while the session was still alive.
    return req.session.destroy(() =>
      next(ApiError.unauthenticated('Your session is no longer valid. Please sign in again.'))
    );
  }

  req.user = user;
  return next();
}

/** Never throws. Used by routes that behave differently for guests. */
export function attachUser(req, res, next) {
  const userId = req.session?.userId;
  req.user = userId ? getUserById(userId) : null;
  return next();
}
