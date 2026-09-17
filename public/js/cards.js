/**
 * cards.js - builds Food/Place card markup from data.
 *
 * Receives data, returns DOM nodes. It never fetches and never reads global
 * state, which is what lets Home, Food and Places share one renderer
 * (Technical Spec section 3).
 *
 * Card anatomy:
 *   article.card
 *     .card__media      image + Favorite button + flags
 *     .card__body       category, title (the link), summary, meta row
 *
 * The title is the only link, and it stretches over the whole card, so a
 * keyboard user gets one stop per card instead of three.
 */

const PLACEHOLDER_IMAGE = '/assets/images/placeholder.svg';

const PRICE_LABELS = {
  1: 'Budget',
  2: 'Mid-range',
  3: 'Higher-end',
};

const HEART_PATH =
  'M12 20.3 4.6 13a4.8 4.8 0 0 1 0-6.8 4.8 4.8 0 0 1 6.8 0l.6.6.6-.6a4.8 4.8 0 0 1 6.8 6.8Z';

/** "1h 30m" style label from minutes. */
export function formatDuration(minutes) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest}m`;
}

/** Admission in VND, or "Free entry" when the fee is zero. */
export function formatAdmission(admission) {
  if (admission === null || admission === undefined) return null;
  if (admission === 0) return 'Free entry';
  return `${admission.toLocaleString('en-US')} VND`;
}

/** Price level as symbols plus words. */
export function formatPriceLevel(level) {
  if (!level) return null;
  return `${'$'.repeat(level)} ${PRICE_LABELS[level] ?? ''}`.trim();
}

/** Inline SVG heart, outline by default and filled by CSS when pressed. */
function createHeartIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('icon-button__icon');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', HEART_PATH);
  svg.append(path);

  return svg;
}

/**
 * Favorite toggle. aria-pressed carries the state and the accessible name
 * changes with it, so a screen reader announces what will happen.
 *
 * Behaviour is attached in Phase 3 (favorites.js); the markup lives here so
 * the control exists on every card from the start.
 */
export function createFavoriteButton(spot, { active = false } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button favorite-button';
  button.dataset.action = 'toggle-favorite';
  button.dataset.spotId = spot.id;
  // The name travels with the button so favorites.js can build an accessible
  // label without searching the page for a matching card.
  button.dataset.spotName = spot.name;
  button.setAttribute('aria-pressed', String(active));
  button.setAttribute(
    'aria-label',
    active ? `Remove ${spot.name} from favorites` : `Save ${spot.name} to favorites`
  );
  button.append(createHeartIcon());
  return button;
}

function createBadge(text, variant) {
  const badge = document.createElement('span');
  badge.className = variant ? `badge badge--${variant}` : 'badge';
  badge.textContent = text;
  return badge;
}

function createMeta(spot) {
  const values = [spot.district];

  if (spot.kind === 'food') {
    values.push(formatPriceLevel(spot.priceLevel));
  } else {
    values.push(formatAdmission(spot.admission), formatDuration(spot.durationMinutes));
  }

  if (typeof spot.rating === 'number') {
    values.push(`${spot.rating.toFixed(1)} / 5`);
  }

  const list = document.createElement('ul');
  list.className = 'card__meta';

  for (const value of values.filter(Boolean)) {
    const item = document.createElement('li');
    item.className = 'card__meta-item';
    item.textContent = value;
    list.append(item);
  }

  return list;
}

/**
 * Build one card.
 *
 * @param {object} spot record from GET /api/spots
 * @param {{ eager?: boolean, favorite?: boolean, showFavorite?: boolean }} [options]
 *        eager:        above the fold, load the image immediately
 *        favorite:     current Favorite state
 *        showFavorite: render the Favorite control (default true)
 * @returns {HTMLElement}
 */
export function createSpotCard(spot, { eager = false, favorite = false, showFavorite = true } = {}) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.spotId = spot.id;
  card.dataset.kind = spot.kind;

  /* --- media --- */
  const media = document.createElement('div');
  media.className = 'card__media';

  const image = document.createElement('img');
  image.className = 'card__image';
  image.src = spot.image ?? PLACEHOLDER_IMAGE;
  // Real photography lands in PERF-01; until then keep the layout intact.
  image.addEventListener(
    'error',
    () => {
      image.src = PLACEHOLDER_IMAGE;
    },
    { once: true }
  );
  image.alt = spot.name;
  image.width = 800;
  image.height = 600;
  image.loading = eager ? 'eager' : 'lazy';
  image.decoding = 'async';
  media.append(image);

  if (showFavorite) {
    const actions = document.createElement('div');
    actions.className = 'card__media-actions';
    actions.append(createFavoriteButton(spot, { active: favorite }));
    media.append(actions);
  }

  const flags = document.createElement('div');
  flags.className = 'card__flags';
  if (spot.isFree) flags.append(createBadge('Free', 'free'));
  if (spot.featured) flags.append(createBadge('Featured', 'featured'));
  if (flags.children.length) media.append(flags);

  /* --- body --- */
  const body = document.createElement('div');
  body.className = 'card__body';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = spot.category;

  const title = document.createElement('h3');
  title.className = 'card__title';

  // Anchor rather than button: it has a real href, so it keeps working if the
  // detail script fails. The page script intercepts the click to open a modal.
  const link = document.createElement('a');
  link.className = 'card__link';
  link.href = `#spot-${spot.id}`;
  link.dataset.action = 'open-detail';
  link.dataset.spotId = spot.id;
  link.textContent = spot.name;
  title.append(link);

  const summary = document.createElement('p');
  summary.className = 'card__summary';
  summary.textContent = spot.shortDescription;

  body.append(eyebrow, title, summary, createMeta(spot));
  card.append(media, body);

  return card;
}

/**
 * Replace a container's children with freshly rendered cards.
 * Rebuilding in one pass is what keeps a refresh from duplicating cards (F1).
 *
 * @param {HTMLElement} container
 * @param {object[]} spots
 * @param {{ eagerCount?: number, favoriteIds?: Set<string>, showFavorite?: boolean }} [options]
 */
export function renderSpotCards(container, spots, options = {}) {
  const { eagerCount = 0, favoriteIds, showFavorite = true } = options;
  delete container.dataset.state;
  const fragment = document.createDocumentFragment();

  spots.forEach((spot, index) => {
    fragment.append(
      createSpotCard(spot, {
        eager: index < eagerCount,
        favorite: favoriteIds?.has(spot.id) ?? false,
        showFavorite,
      })
    );
  });

  container.replaceChildren(fragment);
  return container;
}

/**
 * Skeleton placeholders shown while the first request is in flight. Same box
 * as a real card, so the layout does not shift when data arrives (PERF-03).
 */
export function renderSkeletonCards(container, count = 6) {
  // The CSS height reservation is only needed until something is in the grid.
  delete container.dataset.state;
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < count; index += 1) {
    const card = document.createElement('div');
    card.className = 'skeleton-card';
    card.setAttribute('aria-hidden', 'true');

    const media = document.createElement('div');
    media.className = 'skeleton-card__media';

    const body = document.createElement('div');
    body.className = 'skeleton-card__body';
    for (const modifier of ['title', '', 'short']) {
      const line = document.createElement('div');
      line.className = modifier ? `skeleton-line skeleton-line--${modifier}` : 'skeleton-line';
      body.append(line);
    }

    card.append(media, body);
    fragment.append(card);
  }

  container.replaceChildren(fragment);
  return container;
}
