/**
 * itinerary.js - the My Day planner on the client (DAY-03 to DAY-06).
 *
 * Responsibilities (Technical Spec section 3):
 * - call the itinerary endpoints;
 * - render Morning, Afternoon and Evening;
 * - handle add, move, remove and reset.
 *
 * Every write returns the whole plan, so the drawer re-renders from server
 * state instead of trying to patch itself. That is what keeps the order correct
 * after a reload.
 *
 * Reordering uses up/down buttons rather than drag and drop, on purpose: it is
 * keyboard accessible for free and it was the documented fallback in the risk
 * register.
 */
import { del, get, patch, post, ApiError } from '../services/api-client.js';
import { getUser, onAuthChange } from '../services/auth.service.js';
import { formatAdmission, formatDuration, formatPriceLevel } from '../components/spot-card.js';
import { showToast, withUser } from '../components/site-layout.js';
import { openDialog } from '../components/dialog.js';

const SLOTS = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
];

/** Last plan received from the server. */
let plan = { items: [], slots: { morning: [], afternoon: [], evening: [] }, totals: null };

const elements = {
  drawer: null,
  body: null,
  totals: null,
  resetArea: null,
};

const vnd = (amount) => `${Number(amount ?? 0).toLocaleString('en-US')} VND`;

/* ==========================================================================
   Loading and writing
   ========================================================================== */

function applyPlan(data) {
  if (!data) return;
  plan = data;
  render();
}

export async function loadItinerary() {
  if (!getUser()) {
    plan = { items: [], slots: { morning: [], afternoon: [], evening: [] }, totals: null };
    render();
    return plan;
  }

  try {
    const payload = await get('/itinerary');
    applyPlan(payload?.data);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    plan = { items: [], slots: { morning: [], afternoon: [], evening: [] }, totals: null };
    render();
  }

  return plan;
}

/** True when this spot is already somewhere in the day. */
export function isInDay(spotId) {
  return plan.items.some((item) => item.spot.id === spotId);
}

/**
 * Add a spot to a slot (DAY-03).
 *
 * @param {string} spotId
 * @param {'morning'|'afternoon'|'evening'} timeSlot
 * @param {HTMLElement} [trigger] used for the guest prompt and the busy state
 */
export async function addToDay(spotId, timeSlot, trigger) {
  return withUser({ action: 'build your own day plan', trigger }, async () => {
    if (trigger) {
      trigger.disabled = true;
      trigger.dataset.busy = 'true';
    }

    try {
      const payload = await post('/itinerary/items', { spotId, timeSlot });
      applyPlan(payload?.data);

      const label = SLOTS.find((slot) => slot.id === timeSlot)?.label ?? timeSlot;
      showToast(`Added to ${label.toLowerCase()}.`, { variant: 'success' });
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('Something went wrong.');
      // A duplicate is expected user behaviour, not a failure to hide.
      showToast(apiError.message, { variant: apiError.code === 'CONFLICT' ? 'neutral' : 'error' });
    } finally {
      if (trigger) {
        trigger.disabled = false;
        delete trigger.dataset.busy;
      }
    }
  });
}

async function moveItem(itemId, changes, trigger) {
  if (trigger) trigger.disabled = true;
  try {
    const payload = await patch(`/itinerary/items/${encodeURIComponent(itemId)}`, changes);
    applyPlan(payload?.data);
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError('Could not move that item.');
    showToast(apiError.message, { variant: 'error' });
  } finally {
    if (trigger) trigger.disabled = false;
  }
}

async function removeItem(itemId, name) {
  try {
    const payload = await del(`/itinerary/items/${encodeURIComponent(itemId)}`);
    applyPlan(payload?.data);
    showToast(`${name} removed from your day.`, { variant: 'success' });
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError('Could not remove that item.');
    showToast(apiError.message, { variant: 'error' });
  }
}

async function resetDay() {
  try {
    const payload = await del('/itinerary', { body: { confirm: true } });
    applyPlan(payload?.data);
    showToast('Your day was cleared.', { variant: 'success' });
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError('Could not clear the day.');
    showToast(apiError.message, { variant: 'error' });
  }
}

/* ==========================================================================
   Slot picker, reused by the detail modal and the Favorites drawer
   ========================================================================== */

/**
 * A select plus an Add button for one spot.
 *
 * @param {object} spot
 * @param {{ defaultSlot?: string }} [options]
 * @returns {DocumentFragment}
 */
export function createSlotPicker(spot, { defaultSlot } = {}) {
  const fragment = document.createDocumentFragment();
  const selectId = `slot-${spot.id}-${Math.random().toString(36).slice(2, 7)}`;

  const label = document.createElement('label');
  label.className = 'visually-hidden';
  label.setAttribute('for', selectId);
  label.textContent = `Time of day for ${spot.name}`;

  const select = document.createElement('select');
  select.className = 'select select--compact';
  select.id = selectId;
  for (const slot of SLOTS) {
    const option = document.createElement('option');
    option.value = slot.id;
    option.textContent = slot.label;
    if (slot.id === (defaultSlot ?? suggestSlot(spot))) option.selected = true;
    select.append(option);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--secondary button--compact';
  // Named action: the detail modal also holds a secondary button (the Favorite
  // toggle), so the two must be distinguishable by more than their styling.
  button.dataset.action = 'add-to-day';
  button.dataset.spotId = spot.id;
  button.textContent = 'Add to My Day';
  button.setAttribute('aria-label', `Add ${spot.name} to My Day`);
  button.addEventListener('click', () => addToDay(spot.id, select.value, button));

  fragment.append(label, select, button);
  return fragment;
}

/** A sensible default slot, so the common case is one click. */
function suggestSlot(spot) {
  if (spot.kind === 'food') {
    const hours = spot.openingHours ?? '';
    if (/^0[5-9]/.test(hours)) return 'morning';
    return 'evening';
  }
  return 'afternoon';
}

/* ==========================================================================
   Rendering (DAY-04, DAY-06)
   ========================================================================== */

function createItemRow(item, index, total) {
  const row = document.createElement('li');
  row.className = 'plan-item';
  row.dataset.itemId = String(item.id);

  const position = document.createElement('span');
  position.className = 'plan-item__index';
  position.textContent = String(index + 1);
  position.setAttribute('aria-hidden', 'true');

  const content = document.createElement('div');
  content.className = 'plan-item__content';

  const title = document.createElement('p');
  title.className = 'plan-item__title';
  title.textContent = item.spot.name;

  const meta = document.createElement('p');
  meta.className = 'plan-item__meta';
  meta.textContent = [
    item.spot.district,
    item.spot.kind === 'food'
      ? formatPriceLevel(item.spot.priceLevel)
      : formatAdmission(item.spot.admission),
    formatDuration(item.spot.durationMinutes),
  ]
    .filter(Boolean)
    .join(' · ');

  const actions = document.createElement('div');
  actions.className = 'plan-item__actions';

  /* --- move up / down inside the slot --- */
  const up = document.createElement('button');
  up.type = 'button';
  up.className = 'icon-button icon-button--small';
  up.textContent = '↑';
  up.setAttribute('aria-label', `Move ${item.spot.name} earlier`);
  up.disabled = index === 0;
  up.addEventListener('click', () => moveItem(item.id, { position: index - 1 }, up));

  const down = document.createElement('button');
  down.type = 'button';
  down.className = 'icon-button icon-button--small';
  down.textContent = '↓';
  down.setAttribute('aria-label', `Move ${item.spot.name} later`);
  down.disabled = index === total - 1;
  down.addEventListener('click', () => moveItem(item.id, { position: index + 1 }, down));

  /* --- move to another slot --- */
  const slotLabel = document.createElement('label');
  slotLabel.className = 'visually-hidden';
  slotLabel.setAttribute('for', `move-${item.id}`);
  slotLabel.textContent = `Move ${item.spot.name} to another time of day`;

  const slotSelect = document.createElement('select');
  slotSelect.className = 'select select--compact';
  slotSelect.id = `move-${item.id}`;
  for (const slot of SLOTS) {
    const option = document.createElement('option');
    option.value = slot.id;
    option.textContent = slot.label;
    if (slot.id === item.timeSlot) option.selected = true;
    slotSelect.append(option);
  }
  slotSelect.addEventListener('change', () => {
    moveItem(item.id, { timeSlot: slotSelect.value }, slotSelect);
  });

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'button button--text';
  remove.textContent = 'Remove';
  remove.setAttribute('aria-label', `Remove ${item.spot.name} from your day`);
  remove.addEventListener('click', () => removeItem(item.id, item.spot.name));

  actions.append(up, down, slotLabel, slotSelect, remove);
  content.append(title, meta, actions);
  row.append(position, content);
  return row;
}

function createSlotSection(slot) {
  const items = plan.slots?.[slot.id] ?? [];

  const section = document.createElement('section');
  section.className = 'plan-slot';

  const heading = document.createElement('h3');
  heading.className = 'plan-slot__title';
  heading.textContent = slot.label;

  const count = document.createElement('span');
  count.className = 'plan-slot__count';
  count.textContent = items.length === 1 ? '1 stop' : `${items.length} stops`;
  heading.append(' ', count);

  section.append(heading);

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'plan-slot__empty';
    empty.textContent = 'Nothing planned yet.';
    section.append(empty);
    return section;
  }

  const list = document.createElement('ol');
  list.className = 'plan-list';
  items.forEach((item, index) => list.append(createItemRow(item, index, items.length)));
  section.append(list);

  return section;
}

function renderTotals() {
  if (!elements.totals) return;
  const totals = plan.totals;

  if (!totals || totals.stops === 0) {
    elements.totals.textContent = 'No stops yet.';
    return;
  }

  const parts = [
    totals.stops === 1 ? '1 stop' : `${totals.stops} stops`,
    totals.hasEstimatedItems ? `about ${vnd(totals.estimatedCostVnd)}` : vnd(totals.estimatedCostVnd),
  ];
  if (totals.durationMinutes) {
    parts.push(`${formatDuration(totals.durationMinutes)} of visits`);
  }

  elements.totals.replaceChildren();

  const summary = document.createElement('span');
  summary.className = 'plan-totals__main';
  summary.textContent = parts.join(' · ');
  elements.totals.append(summary);

  if (totals.hasEstimatedItems) {
    // Say where the number comes from rather than presenting it as exact.
    const note = document.createElement('span');
    note.className = 'plan-totals__note';
    note.textContent = `Admission ${vnd(totals.admissionVnd)} is exact; food is estimated from its price level.`;
    elements.totals.append(note);
  }
}

/** Two-step reset, so one stray click cannot clear the day (DAY-05). */
function renderReset() {
  if (!elements.resetArea) return;

  const hasItems = (plan.totals?.stops ?? 0) > 0;
  elements.resetArea.replaceChildren();
  if (!hasItems) return;

  const start = document.createElement('button');
  start.type = 'button';
  start.className = 'button button--text';
  start.textContent = 'Clear the whole day';

  start.addEventListener('click', () => {
    const confirmRow = document.createElement('div');
    confirmRow.className = 'plan-reset__confirm';

    const question = document.createElement('p');
    question.textContent = 'Remove every stop from your day?';
    question.className = 'plan-reset__question';

    const yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'button button--primary button--compact';
    yes.textContent = 'Yes, clear it';
    yes.addEventListener('click', () => resetDay());

    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'button button--text';
    no.textContent = 'Keep my plan';
    no.addEventListener('click', () => renderReset());

    confirmRow.append(question, yes, no);
    elements.resetArea.replaceChildren(confirmRow);
    yes.focus();
  });

  elements.resetArea.append(start);
}

function render() {
  if (!elements.body) return;

  if (!getUser()) {
    const message = document.createElement('div');
    message.className = 'state';
    const title = document.createElement('p');
    title.className = 'state__title';
    title.textContent = 'Sign in to plan your day';
    const text = document.createElement('p');
    text.textContent = 'Your plan is saved to your account, so it is still here next time.';
    message.append(title, text);
    elements.body.replaceChildren(message);
    if (elements.totals) elements.totals.textContent = '';
    if (elements.resetArea) elements.resetArea.replaceChildren();
    return;
  }

  const fragment = document.createDocumentFragment();
  SLOTS.forEach((slot) => fragment.append(createSlotSection(slot)));
  elements.body.replaceChildren(fragment);

  renderTotals();
  renderReset();
}

/** Open the My Day panel, refreshing it first. */
export async function openMyDayDrawer(trigger) {
  if (!elements.drawer) return;
  await loadItinerary();
  openDialog(elements.drawer, { trigger, focus: '[data-role="my-day-close"]' });
}

/* ==========================================================================
   Wiring
   ========================================================================== */

/** Call once per page, after initLayout(). */
export function initItinerary() {
  elements.drawer = document.getElementById('my-day-drawer');
  elements.body = document.querySelector('[data-role="my-day-body"]');
  elements.totals = document.querySelector('[data-role="my-day-totals"]');
  elements.resetArea = document.querySelector('[data-role="my-day-reset"]');

  // Header nav item and the planner CTA on Home both open the panel.
  document.querySelectorAll('[data-action="open-my-day"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      withUser({ action: 'build your own day plan', trigger: button }, () =>
        openMyDayDrawer(button)
      );
    });
  });

  onAuthChange(() => {
    loadItinerary();
  });
}
