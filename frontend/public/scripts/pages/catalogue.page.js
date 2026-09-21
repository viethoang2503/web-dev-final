/**
 * catalogue.js - the Food and Places pages.
 *
 * Both pages are the same machine with a different dataset and a different set
 * of filter controls, so they share one script. The page declares which half of
 * the catalogue it wants with <main data-kind="food"> or data-kind="place".
 *
 * Flow (Technical Spec section 7):
 *   DOMContentLoaded -> request spots -> fill filter options -> render
 *   control change    -> update filter state -> re-render from state
 *
 * Filter controls are wired by their data-filter attribute, so adding a new
 * control is markup plus one option list, never new event code.
 */
import { fetchSpots, ApiError } from '../services/api-client.js';
import { initAuthUI } from '../services/auth.service.js';
import { renderSpotCards, renderSkeletonCards } from '../components/spot-card.js';
import {
  createDetailFavoriteButton,
  getFavoriteIds,
  initFavorites,
  syncFavoriteButtons,
} from '../features/favorites.js';
import { createFilterState } from '../utils/catalogue-filters.js';
import { createSlotPicker, initItinerary } from '../features/itinerary.js';
import { initLayout } from '../components/site-layout.js';
import { openSpotDetail, registerDetailActions } from '../components/dialog.js';

const main = document.querySelector('main');
const kind = main?.dataset.kind === 'place' ? 'place' : 'food';

const elements = {
  grid: document.querySelector('[data-role="grid"]'),
  status: document.querySelector('[data-role="status"]'),
  resultCount: document.querySelector('[data-role="result-count"]'),
  clearFilters: document.querySelector('[data-action="clear-filters"]'),
  clearSearch: document.querySelector('[data-action="clear-search"]'),
  detailDialog: document.getElementById('spot-detail'),
  controls: [...document.querySelectorAll('[data-filter]')],
};

/** Lookup for the detail modal, so opening a card costs no extra request. */
const spotsById = new Map();

/**
 * Skeletons are drawn at module evaluation, not inside DOMContentLoaded.
 *
 * A module script at the end of <body> runs after parsing but before the first
 * paint, so the page is the right height from the start. Waiting for
 * DOMContentLoaded was late enough that the footer visibly jumped down when the
 * cards arrived, which showed up as a Cumulative Layout Shift of 0.13.
 */
renderSkeletonCards(elements.grid, 6);

const filters = createFilterState({
  initial: { sort: 'recommended' },
  onChange: render,
});

/* ==========================================================================
   Rendering
   ========================================================================== */

function setStatus(content) {
  if (!content) {
    elements.status.hidden = true;
    elements.status.replaceChildren();
    return;
  }
  elements.status.hidden = false;
  elements.status.replaceChildren(content);
}

/** Empty state always offers a way back to a full list (F2). */
function buildEmptyState() {
  const wrapper = document.createDocumentFragment();

  const title = document.createElement('p');
  title.className = 'state__title';
  title.textContent = 'No matches';

  const message = document.createElement('p');
  message.textContent =
    kind === 'food'
      ? 'No dish matches every filter. Try a wider price range or clear the filters.'
      : 'No place matches every filter. Try another district or clear the filters.';

  const actions = document.createElement('div');
  actions.className = 'state__actions';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--primary';
  button.textContent = 'Clear filters';
  button.addEventListener('click', () => {
    filters.reset();
    syncControls();
  });
  actions.append(button);

  wrapper.append(title, message, actions);
  return wrapper;
}

function buildErrorState(error, retry) {
  const wrapper = document.createDocumentFragment();

  const title = document.createElement('p');
  title.className = 'state__title';
  title.textContent = 'We could not load this page';

  const message = document.createElement('p');
  message.textContent = error.message;

  const actions = document.createElement('div');
  actions.className = 'state__actions';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--primary';
  button.textContent = 'Retry';
  button.addEventListener('click', retry);
  actions.append(button);

  wrapper.append(title, message, actions);
  return wrapper;
}

/** Called by the filter store on every state change. */
function render(visible, api) {
  elements.status.className = 'state';

  if (visible.length === 0) {
    elements.grid.replaceChildren();
    // No cards, so drop the height reservation and let the empty state size the
    // section instead of leaving a gap under it.
    delete elements.grid.dataset.state;
    setStatus(buildEmptyState());
  } else {
    setStatus(null);
    // The editorial feature panel sits above the grid, so the first cards are
    // below the initial viewport. Keep them lazy instead of eagerly loading
    // imagery the visitor cannot see yet.
    renderSpotCards(elements.grid, visible, { eagerCount: 0, favoriteIds: getFavoriteIds() });
    // A filter change replaces every card, so re-apply the Favorite state.
    syncFavoriteButtons(elements.grid);
  }

  const noun = kind === 'food' ? 'dish' : 'place';
  const plural = kind === 'food' ? 'dishes' : 'places';
  elements.resultCount.textContent =
    visible.length === api.total
      ? `Showing all ${api.total} ${plural}`
      : `${visible.length} of ${api.total} ${visible.length === 1 ? noun : plural}`;

  elements.clearFilters.disabled = api.isDefault;
}

/* ==========================================================================
   Filter controls
   ========================================================================== */

/** Fill a <select> with options coming from the API, keeping "all" first. */
function fillOptions(select, values) {
  if (!select) return;
  const keepFirst = select.querySelector('option');
  const options = values.map((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    return option;
  });
  select.replaceChildren(keepFirst, ...options);
}

/** Push filter state back into the controls, after a reset for example. */
function syncControls() {
  const state = filters.state;
  for (const control of elements.controls) {
    const key = control.dataset.filter;
    if (key in state && control.value !== String(state[key])) {
      control.value = String(state[key]);
    }
  }
}

/** The inline clear button only exists while there is something to clear. */
function syncSearchClear() {
  const search = document.getElementById('filter-search');
  if (!search || !elements.clearSearch) return;
  elements.clearSearch.hidden = search.value.length === 0;
}

function initControls() {
  for (const control of elements.controls) {
    const key = control.dataset.filter;
    // 'input' covers typing and the native clear button on search fields.
    const eventName = control.tagName === 'SELECT' ? 'change' : 'input';
    control.addEventListener(eventName, () => {
      filters.set(key, control.value);
      if (key === 'search') syncSearchClear();
    });
  }

  syncSearchClear();

  elements.clearFilters?.addEventListener('click', () => {
    filters.reset();
    syncControls();
    syncSearchClear();
    document.getElementById('filter-search')?.focus();
  });

  elements.clearSearch?.addEventListener('click', () => {
    const search = document.getElementById('filter-search');
    if (!search) return;
    search.value = '';
    filters.set('search', '');
    syncSearchClear();
    search.focus();
  });
}

/* ==========================================================================
   Delegated card actions
   ========================================================================== */

function initDelegatedActions() {
  // Favorite clicks are handled globally by favorites.js; this only opens
  // the detail modal.
  elements.grid.addEventListener('click', (event) => {
    const detailLink = event.target.closest('[data-action="open-detail"]');
    if (!detailLink) return;

    const spot = spotsById.get(detailLink.dataset.spotId);
    if (spot) {
      event.preventDefault();
      openSpotDetail(elements.detailDialog, spot, { trigger: detailLink });
    }
  });
}

/* ==========================================================================
   Load
   ========================================================================== */

async function load() {
  setStatus(null);
  renderSkeletonCards(elements.grid, 6);
  elements.resultCount.textContent = 'Loading…';

  try {
    const { items, meta } = await fetchSpots({ kind });

    spotsById.clear();
    items.forEach((spot) => spotsById.set(spot.id, spot));

    // Filter options come from the API so they can never drift from the data.
    fillOptions(document.getElementById('filter-category'), meta.filters?.categories ?? []);
    fillOptions(document.getElementById('filter-district'), meta.filters?.districts ?? []);

    filters.setItems(items);
    syncControls();
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError('Unexpected error.');
    elements.grid.replaceChildren();
    elements.status.className = 'state state--error';
    setStatus(buildErrorState(apiError, load));
    elements.resultCount.textContent = 'No results loaded';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initLayout();
  initFavorites();
  initItinerary();
  registerDetailActions({
    favoriteButton: createDetailFavoriteButton,
    slotPicker: createSlotPicker,
  });
  initAuthUI();
  initControls();
  initDelegatedActions();
  load();
});
