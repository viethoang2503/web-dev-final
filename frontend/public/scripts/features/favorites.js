/**
 * favorites.js - saved spots on the client (FAV-03, FAV-04, FAV-05).
 *
 * Responsibilities (Technical Spec section 3):
 * - call the Favorite endpoints;
 * - hold the currently loaded Favorite ids;
 * - keep every heart button on the page in step.
 *
 * The id set is the single source of truth. Buttons are rendered from it, never
 * the other way round, so the same spot shown twice on a page can never end up
 * with two different hearts.
 */
import { del, get, post, ApiError } from '../services/api-client.js';
import { getUser, onAuthChange } from '../services/auth.service.js';
import { formatAdmission, formatPriceLevel } from '../components/spot-card.js';
import { setFavoriteCount, showToast, withUser } from '../components/site-layout.js';
import { openDialog } from '../components/dialog.js';
import { createSlotPicker } from './itinerary.js';

/** Ids of everything the signed-in user has saved. */
const favoriteIds = new Set();

/** Full records, used by the drawer. Loaded with the list. */
let favoriteSpots = [];

const elements = {
  drawer: null,
  body: null,
  footer: null,
};

/* ==========================================================================
   Syncing the UI
   ========================================================================== */

/** True when the spot is saved by the current user. */
export function isFavorite(spotId) {
  return favoriteIds.has(spotId);
}

export function getFavoriteIds() {
  return new Set(favoriteIds);
}

/**
 * Push the id set onto every heart button in the document.
 * Called after any change and after new cards are rendered.
 */
export function syncFavoriteButtons(root = document) {
  root.querySelectorAll('[data-action="toggle-favorite"]').forEach((button) => {
    const { spotId } = button.dataset;
    const active = favoriteIds.has(spotId);
    const name = button.dataset.spotName ?? spotNameFor(spotId) ?? 'this spot';

    button.setAttribute('aria-pressed', String(active));
    button.setAttribute(
      'aria-label',
      active ? `Remove ${name} from favorites` : `Save ${name} to favorites`
    );

    // Buttons that carry a visible label swap it too, so the state is not
    // conveyed by the icon alone.
    if (button.dataset.textActive && button.dataset.textInactive) {
      button.textContent = active ? button.dataset.textActive : button.dataset.textInactive;
    }
  });

  setFavoriteCount(favoriteIds.size);
}

/**
 * Text-labelled Favorite button for the detail modal, where an icon on its own
 * would be ambiguous next to the other actions.
 */
export function createDetailFavoriteButton(spot) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--secondary';
  button.dataset.action = 'toggle-favorite';
  button.dataset.spotId = spot.id;
  button.dataset.spotName = spot.name;
  button.dataset.textActive = 'Saved to favorites';
  button.dataset.textInactive = 'Save to favorites';

  const active = favoriteIds.has(spot.id);
  button.setAttribute('aria-pressed', String(active));
  button.setAttribute(
    'aria-label',
    active ? `Remove ${spot.name} from favorites` : `Save ${spot.name} to favorites`
  );
  button.textContent = active ? button.dataset.textActive : button.dataset.textInactive;

  return button;
}

function spotNameFor(spotId) {
  const card = document.querySelector(`.card[data-spot-id="${spotId}"] .card__link`);
  return card?.textContent?.trim();
}

/** Update local state from any Favorite endpoint response. */
function applyState({ ids, count }) {
  if (Array.isArray(ids)) {
    favoriteIds.clear();
    ids.forEach((id) => favoriteIds.add(id));
  }
  setFavoriteCount(count ?? favoriteIds.size);
  syncFavoriteButtons();
}

/* ==========================================================================
   Loading
   ========================================================================== */

/** Load the list for the signed-in user. Guests end up with an empty set. */
export async function loadFavorites() {
  if (!getUser()) {
    favoriteIds.clear();
    favoriteSpots = [];
    syncFavoriteButtons();
    renderDrawer();
    return favoriteSpots;
  }

  try {
    const payload = await get('/favorites');
    favoriteSpots = payload?.data ?? [];
    applyState({ ids: payload?.meta?.ids ?? favoriteSpots.map((spot) => spot.id) });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    // A guest or an expired session: fall back to empty rather than break.
    favoriteIds.clear();
    favoriteSpots = [];
    syncFavoriteButtons();
  }

  renderDrawer();
  return favoriteSpots;
}

/* ==========================================================================
   Toggling
   ========================================================================== */

/**
 * Save or unsave one spot.
 *
 * The button is disabled for the duration so a double click cannot fire two
 * conflicting requests.
 */
export async function toggleFavorite(spotId, button) {
  const ran = withUser({ action: 'save this to your favorites', trigger: button }, async () => {
    const wasFavorite = favoriteIds.has(spotId);
    const buttons = [...document.querySelectorAll(`[data-action="toggle-favorite"][data-spot-id="${spotId}"]`)];
    buttons.forEach((element) => {
      element.disabled = true;
    });

    try {
      const payload = wasFavorite
        ? await del(`/favorites/${encodeURIComponent(spotId)}`)
        : await post(`/favorites/${encodeURIComponent(spotId)}`);

      applyState(payload?.data ?? {});
      // Keep the drawer list truthful without a second round trip on removal.
      if (wasFavorite) {
        favoriteSpots = favoriteSpots.filter((spot) => spot.id !== spotId);
        renderDrawer();
      } else {
        await loadFavorites();
      }

      buttons.forEach((element) => {
        element.dataset.flash = 'true';
        setTimeout(() => delete element.dataset.flash, 300);
      });

      showToast(wasFavorite ? 'Removed from favorites.' : 'Saved to favorites.', {
        variant: 'success',
      });
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('Something went wrong.');
      if (apiError.isAuthError) {
        // The session expired while the page was open.
        await loadFavorites();
      }
      showToast(apiError.message, { variant: 'error' });
    } finally {
      buttons.forEach((element) => {
        element.disabled = false;
      });
    }
  });

  return ran;
}

/* ==========================================================================
   Drawer (FAV-04)
   ========================================================================== */

function createGroup(title, spots) {
  const section = document.createElement('section');
  section.className = 'drawer-group';

  const heading = document.createElement('h3');
  heading.className = 'drawer-group__title';
  heading.textContent = `${title} (${spots.length})`;

  const list = document.createElement('ul');
  list.className = 'saved-list';

  for (const spot of spots) {
    const item = document.createElement('li');
    item.className = 'saved-item';
    item.dataset.spotId = spot.id;

    const image = document.createElement('img');
    image.className = 'saved-item__image';
    image.src = spot.image ?? '/assets/images/placeholder.svg';
    image.alt = '';
    image.width = 96;
    image.height = 72;
    image.loading = 'lazy';
    image.addEventListener(
      'error',
      () => {
        image.src = '/assets/images/placeholder.svg';
      },
      { once: true }
    );

    const content = document.createElement('div');
    content.className = 'saved-item__content';

    const name = document.createElement('p');
    name.className = 'saved-item__title';
    name.textContent = spot.name;

    const meta = document.createElement('p');
    meta.className = 'saved-item__meta';
    meta.textContent = [
      spot.district,
      spot.kind === 'food' ? formatPriceLevel(spot.priceLevel) : formatAdmission(spot.admission),
    ]
      .filter(Boolean)
      .join(' · ');

    const actions = document.createElement('div');
    actions.className = 'saved-item__actions';
    // Slot picker plus Add button, so a saved spot can go straight into the day.
    actions.append(createSlotPicker(spot));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button button--text';
    remove.dataset.action = 'toggle-favorite';
    remove.dataset.spotId = spot.id;
    remove.dataset.spotName = spot.name;
    remove.setAttribute('aria-pressed', 'true');
    remove.setAttribute('aria-label', `Remove ${spot.name} from favorites`);
    remove.textContent = 'Remove';
    actions.append(remove);

    content.append(name, meta, actions);
    item.append(image, content);
    list.append(item);
  }

  section.append(heading, list);
  return section;
}

function renderDrawer() {
  if (!elements.body) return;

  if (!getUser()) {
    elements.body.replaceChildren(
      buildMessage('Sign in to see your favorites', 'Saved food and places are tied to your account.')
    );
    elements.footer.replaceChildren();
    return;
  }

  if (favoriteSpots.length === 0) {
    elements.body.replaceChildren(
      buildMessage(
        'Nothing saved yet',
        'Tap the heart on any dish or place and it will appear here.'
      )
    );
    elements.footer.replaceChildren();
    return;
  }

  const food = favoriteSpots.filter((spot) => spot.kind === 'food');
  const places = favoriteSpots.filter((spot) => spot.kind === 'place');

  const groups = document.createDocumentFragment();
  if (food.length) groups.append(createGroup('Food', food));
  if (places.length) groups.append(createGroup('Places', places));
  elements.body.replaceChildren(groups);

  const summary = document.createElement('p');
  summary.className = 'drawer__summary';
  summary.textContent = `${favoriteSpots.length} saved · ${food.length} food · ${places.length} places`;
  elements.footer.replaceChildren(summary);

  syncFavoriteButtons(elements.body);
}

function buildMessage(title, text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'state';

  const heading = document.createElement('p');
  heading.className = 'state__title';
  heading.textContent = title;

  const message = document.createElement('p');
  message.textContent = text;

  wrapper.append(heading, message);
  return wrapper;
}

/** Open the Favorites panel, refreshing it first. */
export async function openFavoritesDrawer(trigger) {
  if (!elements.drawer) return;
  await loadFavorites();
  openDialog(elements.drawer, { trigger, focus: '[data-role="favorites-close"]' });
}

/* ==========================================================================
   Wiring
   ========================================================================== */

/** Call once per page, after initLayout(). */
export function initFavorites() {
  elements.drawer = document.getElementById('favorites-drawer');
  elements.body = document.querySelector('[data-role="favorites-body"]');
  elements.footer = document.querySelector('[data-role="favorites-footer"]');

  // One listener for the whole document covers cards, the detail modal and the
  // drawer, including elements that do not exist yet.
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="toggle-favorite"]');
    if (!button) return;
    event.preventDefault();
    toggleFavorite(button.dataset.spotId, button);
  });

  // The header entry point for the panel.
  document.querySelectorAll('[data-action="open-favorites"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      withUser({ action: 'see your saved favorites', trigger: button }, () =>
        openFavoritesDrawer(button)
      );
    });
  });

  // Signing in or out changes whose favorites these are.
  onAuthChange(() => {
    loadFavorites();
  });
}
