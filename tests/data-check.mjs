/**
 * API checks for Favorites and My Day, covering the Gate 3 criteria and the
 * matching rows of the test matrix in docs/05-testing-and-scoring.md.
 *
 *   node tests/data-check.mjs [baseUrl]
 *
 * Two separate clients run side by side, which is how the "different users have
 * separate data" requirement is actually proven rather than assumed.
 */
import { DatabaseSync } from 'node:sqlite';
import { estimateTotals, FOOD_PRICE_ESTIMATE_VND } from '../server/services/pricing.js';
import { check, summary } from './cdp.mjs';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const dbPath = process.env.DATABASE_PATH ?? './server/db/hanoi-local.sqlite';
const stamp = Date.now().toString(36);

function createClient() {
  const jar = new Map();

  return {
    async request(path, { method = 'GET', body } = {}) {
      const headers = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

      const response = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      for (const raw of response.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(';');
        const index = pair.indexOf('=');
        const name = pair.slice(0, index);
        const value = pair.slice(index + 1);
        value === '' ? jar.delete(name) : jar.set(name, value);
      }

      const text = await response.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { raw: text };
      }
      return { status: response.status, body: payload };
    },

    async signUp(username, password = 'demo-pass-1') {
      const created = await this.request('/api/auth/register', {
        method: 'POST',
        body: { username, password },
      });
      return created.body?.data?.user;
    },
  };
}

/* --- guests are locked out --------------------------------------------- */

console.log('\n=== protected endpoints reject guests (AUTH-06) ===');
{
  const guest = createClient();

  const cases = [
    ['GET', '/api/favorites'],
    ['POST', '/api/favorites/food-pho-bo'],
    ['DELETE', '/api/favorites/food-pho-bo'],
    ['GET', '/api/itinerary'],
    ['POST', '/api/itinerary/items'],
    ['PATCH', '/api/itinerary/items/1'],
    ['DELETE', '/api/itinerary/items/1'],
    ['DELETE', '/api/itinerary'],
  ];

  for (const [method, path] of cases) {
    const response = await guest.request(path, { method, body: method === 'GET' ? undefined : {} });
    check(
      `${method} ${path} returns 401 for a guest`,
      response.status === 401 && response.body?.error?.code === 'UNAUTHENTICATED',
      { status: response.status, code: response.body?.error?.code }
    );
  }
}

/* --- favorites --------------------------------------------------------- */

const alice = createClient();
const bob = createClient();
const aliceUser = await alice.signUp(`fav_a_${stamp}`);
const bobUser = await bob.signUp(`fav_b_${stamp}`);

console.log('\n=== favorites ===');
{
  const empty = await alice.request('/api/favorites');
  check('a new account has no favorites', empty.status === 200 && empty.body.meta.count === 0, empty.body?.meta);

  const added = await alice.request('/api/favorites/food-pho-bo', { method: 'POST' });
  check('saving a spot returns 201', added.status === 201, added.status);
  check('response reports the new count', added.body?.data?.count === 1, added.body?.data);
  check('response carries the id list for syncing hearts', added.body?.data?.ids?.includes('food-pho-bo'), added.body?.data?.ids);
  check('response includes the spot itself', added.body?.data?.spot?.name === 'Pho Bo', added.body?.data?.spot?.name);

  const again = await alice.request('/api/favorites/food-pho-bo', { method: 'POST' });
  check('saving twice does not error', again.status === 200, again.status);
  check('saving twice reports created: false', again.body?.data?.created === false, again.body?.data);
  check('count stays 1 after a duplicate', again.body?.data?.count === 1, again.body?.data?.count);

  const db = new DatabaseSync(dbPath);
  const rows = db
    .prepare('SELECT COUNT(*) AS total FROM favorites WHERE user_id = ? AND spot_id = ?')
    .get(aliceUser.id, 'food-pho-bo');
  check('only one favorites row exists for the pair', rows.total === 1, rows);
  db.close();

  const unknown = await alice.request('/api/favorites/does-not-exist', { method: 'POST' });
  check('saving an unknown spot returns 404', unknown.status === 404, unknown.status);

  await alice.request('/api/favorites/place-old-quarter', { method: 'POST' });
  const list = await alice.request('/api/favorites');
  check('list contains both saved spots', list.body.meta.count === 2, list.body.meta);
  check('list separates food and places for the drawer', list.body.meta.food === 1 && list.body.meta.places === 1, list.body.meta);
  check('list items carry full spot data', Boolean(list.body.data[0]?.district), list.body.data[0]);

  /* --- users are separate --- */
  const bobList = await bob.request('/api/favorites');
  check("Bob does not see Alice's favorites", bobList.body.meta.count === 0, bobList.body.meta);

  await bob.request('/api/favorites/food-bun-cha', { method: 'POST' });
  const aliceAgain = await alice.request('/api/favorites');
  check("Bob saving does not change Alice's list", aliceAgain.body.meta.count === 2, aliceAgain.body.meta);
  check('Bob has his own single favorite', (await bob.request('/api/favorites')).body.meta.count === 1);

  /* --- remove --- */
  const removed = await alice.request('/api/favorites/food-pho-bo', { method: 'DELETE' });
  check('removing returns 200', removed.status === 200, removed.status);
  check('removing reports removed: true', removed.body?.data?.removed === true, removed.body?.data);
  check('count drops after removal', removed.body?.data?.count === 1, removed.body?.data?.count);

  const removeAgain = await alice.request('/api/favorites/food-pho-bo', { method: 'DELETE' });
  check('removing something not saved still succeeds', removeAgain.status === 200 && removeAgain.body?.data?.removed === false, removeAgain.body?.data);
}

/* --- itinerary --------------------------------------------------------- */

console.log('\n=== my day: add and duplicates ===');
{
  const empty = await alice.request('/api/itinerary');
  check('a new plan is empty', empty.body?.data?.totals?.stops === 0, empty.body?.data?.totals);
  check('all three slots exist even when empty', Object.keys(empty.body?.data?.slots ?? {}).join(',') === 'morning,afternoon,evening', Object.keys(empty.body?.data?.slots ?? {}));

  const added = await alice.request('/api/itinerary/items', {
    method: 'POST',
    body: { spotId: 'food-pho-bo', timeSlot: 'morning' },
  });
  check('adding an item returns 201', added.status === 201, added.status);
  check('the item lands in the requested slot', added.body?.data?.slots?.morning?.length === 1, added.body?.data?.slots);
  check('the response returns the whole plan', added.body?.data?.totals?.stops === 1, added.body?.data?.totals);

  const duplicate = await alice.request('/api/itinerary/items', {
    method: 'POST',
    body: { spotId: 'food-pho-bo', timeSlot: 'evening' },
  });
  check('the same spot cannot be added twice', duplicate.status === 409, duplicate.status);
  check('duplicate error names the spot', /pho bo/i.test(duplicate.body?.error?.message ?? ''), duplicate.body?.error?.message);

  const badSlot = await alice.request('/api/itinerary/items', {
    method: 'POST',
    body: { spotId: 'food-bun-cha', timeSlot: 'midnight' },
  });
  check('an invalid slot is rejected', badSlot.status === 400, badSlot.status);
  check('slot error is per-field', Boolean(badSlot.body?.error?.details?.timeSlot), badSlot.body?.error?.details);

  const noSpot = await alice.request('/api/itinerary/items', {
    method: 'POST',
    body: { timeSlot: 'morning' },
  });
  check('a missing spotId is rejected', noSpot.status === 400, noSpot.status);
}

console.log('\n=== my day: order, move and totals ===');
{
  // morning: pho bo (already there), then banh mi, then xoi xeo
  await alice.request('/api/itinerary/items', { method: 'POST', body: { spotId: 'food-banh-mi', timeSlot: 'morning' } });
  const third = await alice.request('/api/itinerary/items', { method: 'POST', body: { spotId: 'food-xoi-xeo', timeSlot: 'morning' } });

  const morning = third.body.data.slots.morning;
  check('items append in order', morning.map((i) => i.spot.id).join(',') === 'food-pho-bo,food-banh-mi,food-xoi-xeo', morning.map((i) => i.spot.id));
  check('positions are 0..n-1', morning.map((i) => i.position).join(',') === '0,1,2', morning.map((i) => i.position));

  /* --- move the last item up one place --- */
  const lastId = morning[2].id;
  const movedUp = await alice.request(`/api/itinerary/items/${lastId}`, {
    method: 'PATCH',
    body: { position: 1 },
  });
  check('moving up reorders the slot', movedUp.body.data.slots.morning.map((i) => i.spot.id).join(',') === 'food-pho-bo,food-xoi-xeo,food-banh-mi', movedUp.body.data.slots.morning.map((i) => i.spot.id));
  check('positions stay dense after a move', movedUp.body.data.slots.morning.map((i) => i.position).join(',') === '0,1,2');

  /* --- clamping: moving above the top is a no-op, not an error --- */
  const topId = movedUp.body.data.slots.morning[0].id;
  const clamped = await alice.request(`/api/itinerary/items/${topId}`, {
    method: 'PATCH',
    body: { position: -5 },
  });
  check('moving above the first position is clamped', clamped.status === 200 && clamped.body.data.slots.morning[0].id === topId, clamped.status);

  /* --- move to another slot --- */
  const toMove = clamped.body.data.slots.morning[1];
  const movedSlot = await alice.request(`/api/itinerary/items/${toMove.id}`, {
    method: 'PATCH',
    body: { timeSlot: 'afternoon' },
  });
  check('an item can change slot', movedSlot.body.data.slots.afternoon.some((i) => i.id === toMove.id), movedSlot.body.data.slots.afternoon.map((i) => i.spot.id));
  check('the old slot closes its gap', movedSlot.body.data.slots.morning.map((i) => i.position).join(',') === '0,1', movedSlot.body.data.slots.morning.map((i) => i.position));
  check('total stops are unchanged by a move', movedSlot.body.data.totals.stops === 3, movedSlot.body.data.totals);

  /* --- totals use the documented price table --- */
  const plan = await alice.request('/api/itinerary');
  const spots = plan.body.data.items.map((item) => item.spot);
  const expected = estimateTotals(spots);
  check('stops count matches the item count', plan.body.data.totals.stops === spots.length, plan.body.data.totals);
  check('estimated cost matches the pricing table', plan.body.data.totals.estimatedCostVnd === expected.estimatedCostVnd, {
    api: plan.body.data.totals.estimatedCostVnd,
    expected: expected.estimatedCostVnd,
  });
  check('food-only plan is flagged as estimated', plan.body.data.totals.hasEstimatedItems === true, plan.body.data.totals);
  check('a level 1 dish is valued at the table amount', FOOD_PRICE_ESTIMATE_VND[1] === 50000, FOOD_PRICE_ESTIMATE_VND);
  check('total visit time is summed', typeof plan.body.data.totals.durationMinutes === 'number', plan.body.data.totals.durationMinutes);

  /* --- a place adds its real admission --- */
  const before = plan.body.data.totals.estimatedCostVnd;
  const withPlace = await alice.request('/api/itinerary/items', {
    method: 'POST',
    body: { spotId: 'place-temple-of-literature', timeSlot: 'afternoon' },
  });
  check('adding a paid place adds its exact admission', withPlace.body.data.totals.estimatedCostVnd === before + 70000, {
    before,
    after: withPlace.body.data.totals.estimatedCostVnd,
  });
  check('admission is tracked separately from food', withPlace.body.data.totals.admissionVnd === 70000, withPlace.body.data.totals);
}

console.log('\n=== my day: ownership, remove and reset ===');
{
  const alicePlan = await alice.request('/api/itinerary');
  const aliceItemId = alicePlan.body.data.items[0].id;

  /* --- Bob cannot touch Alice's item --- */
  const stolenPatch = await bob.request(`/api/itinerary/items/${aliceItemId}`, {
    method: 'PATCH',
    body: { timeSlot: 'evening' },
  });
  const stolenDelete = await bob.request(`/api/itinerary/items/${aliceItemId}`, { method: 'DELETE' });
  check("Bob patching Alice's item returns 404", stolenPatch.status === 404, stolenPatch.status);
  check("Bob deleting Alice's item returns 404", stolenDelete.status === 404, stolenDelete.status);

  const stillThere = await alice.request('/api/itinerary');
  check("Alice's item survived Bob's attempts", stillThere.body.data.items.some((i) => i.id === aliceItemId));

  /* --- Bob has his own separate plan --- */
  await bob.request('/api/itinerary/items', { method: 'POST', body: { spotId: 'place-old-quarter', timeSlot: 'evening' } });
  const bobPlan = await bob.request('/api/itinerary');
  check('Bob has his own plan with one stop', bobPlan.body.data.totals.stops === 1, bobPlan.body.data.totals);
  check('Alice still has her four stops', (await alice.request('/api/itinerary')).body.data.totals.stops === 4);

  /* --- remove one --- */
  const removed = await alice.request(`/api/itinerary/items/${aliceItemId}`, { method: 'DELETE' });
  check('removing an item returns the updated plan', removed.body.data.totals.stops === 3, removed.body.data.totals);
  check('removed item is gone', !removed.body.data.items.some((i) => i.id === aliceItemId));

  /* --- reset needs confirmation --- */
  const unconfirmed = await alice.request('/api/itinerary', { method: 'DELETE', body: {} });
  check('reset without confirmation is refused', unconfirmed.status === 400, unconfirmed.status);
  check('refusal explains what is needed', Boolean(unconfirmed.body?.error?.details?.confirm), unconfirmed.body?.error?.details);
  check('nothing was deleted by the refused reset', (await alice.request('/api/itinerary')).body.data.totals.stops === 3);

  const confirmed = await alice.request('/api/itinerary', { method: 'DELETE', body: { confirm: true } });
  check('confirmed reset clears the day', confirmed.body.data.totals.stops === 0, confirmed.body.data.totals);
  check('reset reports how many were removed', confirmed.body.data.removed === 3, confirmed.body.data.removed);
  check("reset did not touch Bob's plan", (await bob.request('/api/itinerary')).body.data.totals.stops === 1);
  check('favorites survive an itinerary reset', (await alice.request('/api/favorites')).body.meta.count === 1);
}

/* --- cleanup ----------------------------------------------------------- */

{
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  const removed = db
    .prepare('DELETE FROM users WHERE username IN (?, ?)')
    .run(aliceUser.username, bobUser.username);
  db.close();
  console.log(`\n(cleanup: removed ${removed.changes} test accounts)`);
}

process.exit(summary() === 0 ? 0 : 1);
