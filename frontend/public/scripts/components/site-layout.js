/**
 * layout.js - behaviour for the shared page shell (UI-01, UI-02).
 *
 * The header and footer markup is written statically into every page so
 * navigation works even if JavaScript fails. This module only adds behaviour:
 * mobile menu, sticky shadow, active nav item, the Favorites entry point and
 * the small feedback helpers every page needs.
 *
 * Note: this file is an addition to the module list in the Technical Spec. It
 * keeps shell concerns out of the page scripts.
 */
import { openDialog, initDialogs } from './dialog.js';

/* ==========================================================================
   Mobile navigation
   ========================================================================== */

const MOBILE_BREAKPOINT = '(max-width: 899px)';

function initMobileNav() {
  const toggle = document.querySelector('[data-action="toggle-menu"]');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  const mobile = window.matchMedia(MOBILE_BREAKPOINT);

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.hidden = !open;
  };

  // On desktop the nav is always visible; hidden only applies to mobile.
  const applyViewport = () => {
    if (mobile.matches) {
      setOpen(false);
    } else {
      nav.hidden = false;
      toggle.setAttribute('aria-expanded', 'false');
    }
  };

  applyViewport();
  mobile.addEventListener('change', applyViewport);

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  // Escape closes the menu and returns focus to the button.
  nav.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobile.matches) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Clicking outside closes it, so the menu never covers content silently.
  document.addEventListener('click', (event) => {
    if (!mobile.matches || toggle.getAttribute('aria-expanded') !== 'true') return;
    if (nav.contains(event.target) || toggle.contains(event.target)) return;
    setOpen(false);
  });
}

/* ==========================================================================
   Sticky header shadow
   ========================================================================== */

function initStickyHeader() {
  const header = document.querySelector('[data-role="site-header"]');
  if (!header) return;

  // A sentinel above the fold is cheaper than a scroll listener.
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
  document.body.prepend(sentinel);

  const observer = new IntersectionObserver(
    ([entry]) => {
      header.dataset.stuck = String(!entry.isIntersecting);
    },
    { threshold: 0 }
  );

  observer.observe(sentinel);
}

/* ==========================================================================
   Active navigation item
   ========================================================================== */

function initActiveNav() {
  const path = window.location.pathname.replace(/index\.html$/, '') || '/';

  document.querySelectorAll('.site-nav__link').forEach((link) => {
    const url = new URL(link.href, window.location.origin);
    const target = url.pathname.replace(/index\.html$/, '');

    // In-page links such as #planner are actions, not a current page.
    if (url.hash) {
      link.removeAttribute('aria-current');
      return;
    }

    if ((target || '/') === path) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

/* ==========================================================================
   Image fallback
   ========================================================================== */

const PLACEHOLDER_IMAGE = '/assets/images/placeholder.svg';

/**
 * Static <img> tags marked with data-fallback swap to the placeholder if the
 * file is missing. Real photography arrives in PERF-01; this keeps the layout
 * intact until then instead of showing a broken-image icon.
 */
function initImageFallbacks(root = document) {
  root.querySelectorAll('img[data-fallback]').forEach((image) => {
    const swap = () => {
      if (!image.src.endsWith(PLACEHOLDER_IMAGE)) {
        image.src = PLACEHOLDER_IMAGE;
      }
    };

    // complete + naturalWidth 0 means it already failed before this ran.
    if (image.complete && image.naturalWidth === 0) {
      swap();
    }
    image.addEventListener('error', swap, { once: true });
  });
}

/* ==========================================================================
   Toast feedback
   ========================================================================== */

let toastRegion;

function getToastRegion() {
  if (toastRegion?.isConnected) return toastRegion;

  toastRegion = document.createElement('div');
  toastRegion.className = 'toast-region';
  // polite: feedback is announced without interrupting the current task.
  toastRegion.setAttribute('role', 'status');
  toastRegion.setAttribute('aria-live', 'polite');
  document.body.append(toastRegion);
  return toastRegion;
}

/**
 * Show a short confirmation or error message.
 *
 * @param {string} message
 * @param {{ variant?: 'success' | 'error' | 'neutral', duration?: number }} [options]
 */
export function showToast(message, { variant = 'neutral', duration = 3200 } = {}) {
  const region = getToastRegion();

  const toast = document.createElement('p');
  toast.className = variant === 'neutral' ? 'toast' : `toast toast--${variant}`;
  toast.textContent = message;
  region.append(toast);

  window.setTimeout(() => toast.remove(), duration);
  return toast;
}

/* ==========================================================================
   Guest prompt for protected actions (FAV-05 groundwork)
   ========================================================================== */

/**
 * Ask a guest to sign in instead of failing silently.
 * Real auth state arrives in Phase 2; until then every protected action lands
 * here, which is also the behaviour a guest should keep afterwards.
 *
 * @param {{ action?: string, trigger?: HTMLElement }} [options]
 */
export function promptSignIn({ action = 'save this', trigger } = {}) {
  const dialog = document.getElementById('sign-in-prompt');

  if (!dialog) {
    showToast('Please sign in to continue.', { variant: 'error' });
    return;
  }

  const message = dialog.querySelector('[data-role="prompt-message"]');
  if (message) {
    message.textContent = `Sign in to ${action}. Your favorites and My Day plan are saved to your account.`;
  }

  openDialog(dialog, { trigger, focus: '[data-role="prompt-primary"]' });
}

/* ==========================================================================
   Shared auth state

   Kept here, not in auth.js, so the shell can react to sign-in without
   layout.js importing auth.js (auth.js already imports this module).
   ========================================================================== */

const authState = { user: null };

/** Called by auth.js whenever the signed-in user changes. */
export function setAuthUser(user) {
  authState.user = user ?? null;
}

/** The current user, or null for a guest. */
export function getAuthUser() {
  return authState.user;
}

/**
 * Run an action only when signed in, otherwise prompt (FAV-05).
 *
 * This is the single gate for protected actions on the client, so no protected
 * action can fail silently.
 *
 * @param {{ action: string, trigger?: HTMLElement }} options
 * @param {(user: object) => any} run
 * @returns {false | any} false when the visitor was prompted instead, otherwise
 *          whatever run() returned, so an async action can be awaited.
 */
export function withUser({ action, trigger }, run) {
  if (!authState.user) {
    promptSignIn({ action, trigger });
    return false;
  }
  return run(authState.user);
}

/* ==========================================================================
   Header actions

   The Favorites and My Day buttons are bound by favorites.js and itinerary.js,
   which own those panels. layout.js only provides the shell and the guest gate.
   ========================================================================== */

/** Update the Favorites counter in the header. */
export function setFavoriteCount(count) {
  document.querySelectorAll('[data-role="favorite-count"]').forEach((badge) => {
    badge.textContent = String(count);
    badge.hidden = count === 0;
  });

  document.querySelectorAll('[data-action="open-favorites"]').forEach((button) => {
    button.setAttribute(
      'aria-label',
      count === 0 ? 'Favorites, nothing saved yet' : `Favorites, ${count} saved`
    );
  });
}

/** Call once per page, from the page script. */
export function initLayout() {
  initDialogs();
  initMobileNav();
  initStickyHeader();
  initActiveNav();
  initImageFallbacks();
  setFavoriteCount(0);
}
