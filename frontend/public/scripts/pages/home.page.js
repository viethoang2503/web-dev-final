/**
 * home.js - Home page script (HOME-04, HOME-05).
 *
 * One request to /api/spots, then split into the featured Food and featured
 * Place sections. Cards come from the shared renderer, so Home, Food and
 * Places always look and behave the same.
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
import { createSlotPicker, initItinerary } from '../features/itinerary.js';
import { initLayout } from '../components/site-layout.js';
import { openSpotDetail, registerDetailActions } from '../components/dialog.js';

const FEATURED_FOOD_COUNT = 4;
const FEATURED_PLACES_COUNT = 3;

const elements = {
  foodGrid: document.querySelector('[data-role="food-grid"]'),
  foodStatus: document.querySelector('[data-role="food-status"]'),
  placesGrid: document.querySelector('[data-role="places-grid"]'),
  placesStatus: document.querySelector('[data-role="places-status"]'),
  statFood: document.querySelector('[data-role="stat-food"]'),
  statPlaces: document.querySelector('[data-role="stat-places"]'),
  statDistricts: document.querySelector('[data-role="stat-districts"]'),
  detailDialog: document.getElementById('spot-detail'),
};

/** Every spot currently on the page, so the detail modal needs no extra fetch. */
const spotsById = new Map();

/**
 * Draw the skeletons now, at module evaluation, rather than inside
 * DOMContentLoaded. A module script at the end of <body> runs before the first
 * paint, so the two featured sections already occupy their final height and the
 * footer does not jump when the data arrives.
 */
renderSkeletonCards(elements.foodGrid, FEATURED_FOOD_COUNT);
renderSkeletonCards(elements.placesGrid, FEATURED_PLACES_COUNT);
elements.foodStatus.hidden = true;
elements.placesStatus.hidden = true;

/** Featured first, then the highest rated, so the section is never empty. */
function pickFeatured(items, count) {
  const featured = items.filter((item) => item.featured);
  const rest = items.filter((item) => !item.featured);
  return [...featured, ...rest].slice(0, count);
}

function showError(statusElement, gridElement, error, retry) {
  gridElement.replaceChildren();
  statusElement.hidden = false;
  statusElement.className = 'state state--error';
  statusElement.replaceChildren();

  const title = document.createElement('p');
  title.className = 'state__title';
  title.textContent = 'We could not load this section';

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

  statusElement.append(title, message, actions);
}

async function load() {
  elements.foodStatus.hidden = true;
  elements.placesStatus.hidden = true;
  renderSkeletonCards(elements.foodGrid, FEATURED_FOOD_COUNT);
  renderSkeletonCards(elements.placesGrid, FEATURED_PLACES_COUNT);

  try {
    const { items, meta } = await fetchSpots();

    spotsById.clear();
    items.forEach((spot) => spotsById.set(spot.id, spot));

    const food = items.filter((spot) => spot.kind === 'food');
    const places = items.filter((spot) => spot.kind === 'place');

    const favoriteIds = getFavoriteIds();
    // Both featured sections sit well below the hero, so every card image is
    // lazy here. The hero collage is the only eager imagery on this page.
    renderSpotCards(elements.foodGrid, pickFeatured(food, FEATURED_FOOD_COUNT), {
      favoriteIds,
    });
    renderSpotCards(elements.placesGrid, pickFeatured(places, FEATURED_PLACES_COUNT), {
      favoriteIds,
    });
    // Cards are new DOM, so push the current Favorite state onto them.
    syncFavoriteButtons();

    elements.statFood.textContent = String(food.length);
    elements.statPlaces.textContent = String(places.length);
    elements.statDistricts.textContent = String(meta.filters?.districts?.length ?? '—');
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError('Unexpected error.');
    showError(elements.foodStatus, elements.foodGrid, apiError, load);
    showError(elements.placesStatus, elements.placesGrid, apiError, load);
  }
}

/**
 * One delegated listener on <main> covers every card, present and future.
 * Re-rendering a grid never needs listeners to be re-attached (PERF, section 5
 * of the testing doc).
 */
function initDelegatedActions() {
  // Favorite clicks are handled globally by favorites.js; this only opens
  // the detail modal.
  document.querySelector('main').addEventListener('click', (event) => {
    const detailLink = event.target.closest('[data-action="open-detail"]');
    if (!detailLink) return;

    const spot = spotsById.get(detailLink.dataset.spotId);
    if (spot) {
      event.preventDefault();
      openSpotDetail(elements.detailDialog, spot, { trigger: detailLink });
    }
  });
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
  initDelegatedActions();
  load();
});
