/**
 * auth.js - current user, sign-in actions and the header's auth state
 * (FORM-03, FORM-04).
 *
 * Responsibilities (Technical Spec section 3):
 * - load the current user;
 * - handle register, login and logout;
 * - update the header auth UI.
 *
 * There is no token in localStorage. The session lives in an httpOnly cookie,
 * so JavaScript cannot read it and cannot leak it.
 */
import { get, post, ApiError } from './api.js';
import { setAuthUser, showToast } from './layout.js';

/** Cached so several modules on one page do not each hit /api/auth/me. */
let currentUser = null;
let loaded = false;

/** Listeners that want to know when the user changes (Phase 3 uses this). */
const listeners = new Set();

export function onAuthChange(listener) {
  listeners.add(listener);
  if (loaded) listener(currentUser);
  return () => listeners.delete(listener);
}

function publish() {
  setAuthUser(currentUser);
  renderHeader(currentUser);
  listeners.forEach((listener) => listener(currentUser));
}

export function getUser() {
  return currentUser;
}

/* ==========================================================================
   Header
   ========================================================================== */

function renderHeader(user) {
  const signIn = document.querySelector('[data-role="auth-sign-in"]');
  const account = document.querySelector('[data-role="auth-account"]');
  const name = document.querySelector('[data-role="auth-username"]');

  if (signIn) signIn.hidden = Boolean(user);
  if (account) account.hidden = !user;
  if (name && user) name.textContent = user.username;

  // Pages can style or hide things based on this, without asking the API.
  document.documentElement.dataset.auth = user ? 'user' : 'guest';
}

/* ==========================================================================
   Actions
   ========================================================================== */

/** Load the current user once per page. Never throws; a guest is null. */
export async function loadUser({ force = false } = {}) {
  if (loaded && !force) return currentUser;

  try {
    const payload = await get('/auth/me');
    currentUser = payload?.data?.user ?? null;
  } catch (error) {
    // A failed /me should not block browsing; treat it as a guest.
    currentUser = null;
    if (!(error instanceof ApiError)) throw error;
  }

  loaded = true;
  publish();
  return currentUser;
}

/** @throws {ApiError} with error.details keyed by field name */
export async function register(credentials) {
  const payload = await post('/auth/register', credentials);
  currentUser = payload?.data?.user ?? null;
  loaded = true;
  publish();
  return currentUser;
}

/** @throws {ApiError} generic message on bad credentials */
export async function login(credentials) {
  const payload = await post('/auth/login', credentials);
  currentUser = payload?.data?.user ?? null;
  loaded = true;
  publish();
  return currentUser;
}

export async function logout() {
  await post('/auth/logout');
  currentUser = null;
  loaded = true;
  publish();
}

/* ==========================================================================
   Wiring
   ========================================================================== */

/**
 * Call once per page, after initLayout(). Renders the header immediately from
 * the cached state and then refreshes it from the API.
 */
export function initAuthUI() {
  document.querySelectorAll('[data-action="logout"]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.dataset.busy = 'true';
      try {
        await logout();
        showToast('Signed out.', { variant: 'success' });
      } catch (error) {
        showToast(error.message ?? 'Could not sign out.', { variant: 'error' });
      } finally {
        button.disabled = false;
        delete button.dataset.busy;
      }
    });
  });

  return loadUser();
}
