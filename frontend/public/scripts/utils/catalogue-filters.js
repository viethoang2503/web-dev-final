/**
 * filters.js - owns filter state for the catalogue pages (FOOD-03..05, PLACE-03).
 *
 * Filtering happens in the browser because the dataset is 20 records
 * (Technical Spec section 8). The pipeline is always the same:
 *
 *   original data -> search -> selected filters -> sort a copy -> render
 *
 * Rules this module enforces:
 * - the original array is never mutated, sorting works on a copy;
 * - active filters are the single source of truth, the DOM only reflects them;
 * - all active filters combine with AND logic;
 * - text comparison is lowercase and trimmed.
 */

/** Filter values that mean "no filter". */
const ANY = 'all';

/** Duration buckets for Places, in minutes. */
const DURATION_BUCKETS = {
  short: (minutes) => minutes <= 60,
  medium: (minutes) => minutes > 60 && minutes <= 90,
  long: (minutes) => minutes > 90,
};

export const DEFAULT_STATE = Object.freeze({
  search: '',
  category: ANY,
  district: ANY,
  price: ANY,
  admission: ANY,
  duration: ANY,
  sort: 'recommended',
});

const normalise = (value) => String(value ?? '').trim().toLowerCase();

/* ==========================================================================
   Sorting
   ========================================================================== */

const byName = (a, b) => a.name.localeCompare(b.name);

/** Featured first, then rating, then name. Same order the API returns. */
function recommended(a, b) {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  if ((b.rating ?? 0) !== (a.rating ?? 0)) return (b.rating ?? 0) - (a.rating ?? 0);
  return byName(a, b);
}

export const SORTERS = {
  recommended,
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byName(a, b),
  'price-asc': (a, b) => (a.priceLevel ?? 0) - (b.priceLevel ?? 0) || recommended(a, b),
  'price-desc': (a, b) => (b.priceLevel ?? 0) - (a.priceLevel ?? 0) || recommended(a, b),
  'duration-asc': (a, b) => (a.durationMinutes ?? 0) - (b.durationMinutes ?? 0) || recommended(a, b),
  'duration-desc': (a, b) => (b.durationMinutes ?? 0) - (a.durationMinutes ?? 0) || recommended(a, b),
  'admission-asc': (a, b) => (a.admission ?? 0) - (b.admission ?? 0) || recommended(a, b),
};

/* ==========================================================================
   Predicates
   ========================================================================== */

/** Search across the fields a visitor would reasonably type. */
function matchesSearch(spot, term) {
  if (!term) return true;
  const haystack = [spot.name, spot.category, spot.district, spot.shortDescription]
    .map(normalise)
    .join(' ');
  return haystack.includes(term);
}

function matchesValue(actual, selected) {
  return selected === ANY || normalise(actual) === normalise(selected);
}

function matchesPrice(spot, selected) {
  return selected === ANY || spot.priceLevel === Number(selected);
}

function matchesAdmission(spot, selected) {
  if (selected === ANY) return true;
  if (selected === 'free') return spot.admission === 0;
  if (selected === 'paid') return typeof spot.admission === 'number' && spot.admission > 0;
  return true;
}

function matchesDuration(spot, selected) {
  if (selected === ANY) return true;
  const test = DURATION_BUCKETS[selected];
  return typeof spot.durationMinutes === 'number' && test ? test(spot.durationMinutes) : false;
}

/**
 * Apply the whole pipeline. Pure function: same input, same output.
 *
 * @param {object[]} items source records, never modified
 * @param {typeof DEFAULT_STATE} state
 * @returns {object[]} a new array
 */
export function applyFilters(items, state) {
  const term = normalise(state.search);

  const filtered = items.filter(
    (spot) =>
      matchesSearch(spot, term) &&
      matchesValue(spot.category, state.category) &&
      matchesValue(spot.district, state.district) &&
      matchesPrice(spot, state.price) &&
      matchesAdmission(spot, state.admission) &&
      matchesDuration(spot, state.duration)
  );

  const sorter = SORTERS[state.sort] ?? SORTERS.recommended;
  // Sort a copy so the caller's array keeps its original order.
  return [...filtered].sort(sorter);
}

/* ==========================================================================
   State container
   ========================================================================== */

/**
 * Create the filter store for one page.
 *
 * @param {{ items?: object[], initial?: object, onChange?: (visible: object[], api: object) => void }} options
 */
export function createFilterState({ items = [], initial = {}, onChange } = {}) {
  let source = items;
  let state = { ...DEFAULT_STATE, ...initial };
  const defaults = { ...state };

  const api = {
    /** Current visible records after search, filters and sort. */
    get visible() {
      return applyFilters(source, state);
    },

    /** Read-only copy of the active filters. */
    get state() {
      return { ...state };
    },

    get total() {
      return source.length;
    },

    /** True when nothing is filtering the list. */
    get isDefault() {
      return Object.keys(defaults).every((key) => state[key] === defaults[key]);
    },

    /** Replace the source data, for example after a reload. */
    setItems(nextItems) {
      source = nextItems;
      api.notify();
      return api;
    },

    /** Change one filter. Unknown keys are ignored on purpose. */
    set(key, value) {
      if (!(key in state) || state[key] === value) return api;
      state = { ...state, [key]: value };
      api.notify();
      return api;
    },

    /** Back to the initial order and the full list (FOOD-06). */
    reset() {
      state = { ...defaults };
      api.notify();
      return api;
    },

    notify() {
      onChange?.(api.visible, api);
      return api;
    },
  };

  return api;
}
