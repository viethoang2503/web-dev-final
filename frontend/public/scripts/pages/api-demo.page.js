/**
 * main.js - entry script for the Phase 0 verification page.
 *
 * It exists to prove Gate 0: the server runs, the API answers with the
 * documented envelope, and cards render from that data. M2 replaces this with
 * the real Home page in HOME-01.
 */
import { fetchSpots, ApiError } from '../services/api-client.js';
import { renderSpotCards } from '../components/spot-card.js';

const elements = {
  status: document.querySelector('[data-role="status"]'),
  grid: document.querySelector('[data-role="grid"]'),
  count: document.querySelector('[data-role="count"]'),
  checks: document.querySelector('[data-role="checks"]'),
};

/** Tick one item in the Gate 0 checklist. */
function setCheck(name, passed, note) {
  const item = elements.checks?.querySelector(`[data-check="${name}"]`);
  if (!item) return;
  item.dataset.pass = String(passed);
  if (note) {
    const detail = item.querySelector('[data-role="note"]');
    if (detail) detail.textContent = note;
  }
}

function showLoading() {
  elements.status.hidden = false;
  elements.status.className = 'state';
  elements.status.textContent = 'Loading Hanoi Local content…';
}

function showError(error) {
  elements.status.hidden = false;
  elements.status.className = 'state state--error';
  elements.status.replaceChildren();

  const message = document.createElement('p');
  message.textContent = error.message;

  const actions = document.createElement('div');
  actions.className = 'state__actions';

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'button button--primary';
  retry.textContent = 'Retry';
  retry.addEventListener('click', load);
  actions.append(retry);

  elements.status.append(message, actions);
}

async function load() {
  showLoading();

  try {
    const [all, food, places] = await Promise.all([
      fetchSpots(),
      fetchSpots({ kind: 'food' }),
      fetchSpots({ kind: 'place' }),
    ]);

    elements.status.hidden = true;

    // Render a small sample: three Food records is enough for the gate.
    renderSpotCards(elements.grid, food.items.slice(0, 3), { eagerCount: 3 });
    elements.count.textContent =
      `${all.meta.count} spots total — ${food.meta.count} food, ${places.meta.count} places.`;

    setCheck('server', true, 'Static page served by Express.');
    setCheck('api', all.meta.count > 0, `GET /api/spots returned ${all.meta.count} records.`);
    setCheck(
      'seed',
      food.meta.count >= 10 && places.meta.count >= 10,
      `${food.meta.count} food and ${places.meta.count} places seeded.`
    );
    setCheck('card', elements.grid.children.length > 0, 'Cards built by cards.js from API data.');
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError('Unexpected error.');
    showError(apiError);
    setCheck('api', false, apiError.message);
    setCheck('seed', false, 'Could not verify seed data.');
    setCheck('card', false, 'No cards rendered.');
  }
}

document.addEventListener('DOMContentLoaded', load);
