/**
 * Browser checks for the Favorites and My Day drawers (Gate 3).
 *
 *   node tests/drawers.test.mjs [baseUrl]
 *
 * Covers the parts only a browser can prove: the same spot's hearts staying in
 * step across a page, state surviving a reload, the drawers being keyboard
 * closable, moving items between slots from the UI, the two-step reset, and
 * personal data disappearing on logout.
 */
import { DatabaseSync } from 'node:sqlite';
import { withPage, check, summary } from './helpers/browser.mjs';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const dbPath = process.env.DATABASE_PATH ?? './backend/data/hanoi-local.sqlite';
const stamp = Date.now().toString(36);
const user = { username: `dw_${stamp}`, password: 'demo-pass-1' };

/** Register through the UI so the page ends up in a signed-in state. */
const signUp = async (page, credentials = user) => {
  await page.evaluate(`window.location.href = '/account.html'; return true;`);
  await page.wait(1500);
  await page.fill('#register-username', credentials.username);
  await page.fill('#register-password', credentials.password);
  await page.click('[data-form="register"] button[type="submit"]');
  await page.wait(1100);
};

const heartState = (spotId) => `
  const buttons = [...document.querySelectorAll('[data-action="toggle-favorite"][data-spot-id="${spotId}"]')];
  return {
    count: buttons.length,
    pressed: buttons.map((b) => b.getAttribute('aria-pressed')),
    labels: buttons.map((b) => b.getAttribute('aria-label')),
  };
`;

const badge = `
  const el = document.querySelector('[data-role="favorite-count"]');
  return { text: el.textContent.trim(), hidden: el.hidden };
`;

async function checkFavorites() {
  console.log(`\n=== Favorites: hearts, badge, drawer, persistence ===`);

  await withPage(`${base}/`, { width: 1440 }, async (page) => {
    /* --- guest --- */
    await page.click('[data-action="toggle-favorite"]');
    await page.wait(400);
    check('guest clicking a heart gets the sign-in prompt', await page.evaluate(`document.getElementById('sign-in-prompt').open`));
    await page.key('Escape');
    await page.wait(200);

    await page.click('[data-action="open-favorites"]');
    await page.wait(400);
    check('guest opening Favorites gets the prompt, not an empty drawer', await page.evaluate(`
      return document.getElementById('sign-in-prompt').open && !document.getElementById('favorites-drawer').open;
    `));
    await page.key('Escape');
    await page.wait(200);

    /* --- register, then save from a card --- */
    await signUp(page);
    await page.evaluate(`window.location.href = '/food.html'; return true;`);
    await page.wait(1800);

    check('badge starts hidden with nothing saved', (await page.evaluate(badge)).hidden === true);

    await page.click('[data-action="toggle-favorite"][data-spot-id="food-pho-bo"]');
    await page.wait(700);

    const saved = await page.evaluate(heartState('food-pho-bo'));
    check('the heart is pressed after saving', saved.pressed.every((value) => value === 'true'), saved);
    check('the label now offers to remove it', saved.labels.every((label) => /remove/i.test(label)), saved.labels);

    const badgeAfter = await page.evaluate(badge);
    check('header badge shows 1', badgeAfter.text === '1' && badgeAfter.hidden === false, badgeAfter);

    /* --- the same spot in the detail modal must agree (FAV-03) --- */
    await page.click('.card[data-spot-id="food-pho-bo"] .card__link');
    await page.wait(600);
    const inModal = await page.evaluate(`
      const dialog = document.getElementById('spot-detail');
      const button = dialog.querySelector('[data-action="toggle-favorite"]');
      return {
        open: dialog.open,
        pressed: button?.getAttribute('aria-pressed'),
        text: button?.textContent.trim(),
        hasSlotPicker: !!dialog.querySelector('[data-role="detail-actions"] select') && !!dialog.querySelector('[data-action="add-to-day"]'),
      };
    `);
    check('the detail modal shows the same saved state', inModal.pressed === 'true', inModal);
    check('the modal button says it is saved', /saved/i.test(inModal.text ?? ''), inModal.text);
    check('the modal offers a My Day slot picker', inModal.hasSlotPicker, inModal);

    /* --- unsaving in the modal updates the card behind it --- */
    await page.evaluate(`document.querySelector('#spot-detail [data-action="toggle-favorite"]').click(); return true;`);
    await page.wait(700);
    const bothAfterRemove = await page.evaluate(heartState('food-pho-bo'));
    check('unsaving in the modal updates every heart for that spot', bothAfterRemove.pressed.every((v) => v === 'false'), bothAfterRemove);
    check('badge hides again at zero', (await page.evaluate(badge)).hidden === true);

    await page.key('Escape');
    await page.wait(300);

    /* --- save two, then check the drawer groups them --- */
    await page.click('[data-action="toggle-favorite"][data-spot-id="food-pho-bo"]');
    await page.wait(600);
    await page.evaluate(`window.location.href = '/places.html'; return true;`);
    await page.wait(1800);
    check('badge carries the saved count onto another page', (await page.evaluate(badge)).text === '1', await page.evaluate(badge));
    await page.click('[data-action="toggle-favorite"][data-spot-id="place-old-quarter"]');
    await page.wait(700);

    await page.click('[data-action="open-favorites"]');
    await page.wait(800);
    const drawer = await page.evaluate(`
      const dialog = document.getElementById('favorites-drawer');
      return {
        open: dialog.open,
        groups: [...dialog.querySelectorAll('.drawer-group__title')].map((el) => el.textContent.trim()),
        items: dialog.querySelectorAll('.saved-item').length,
        summary: dialog.querySelector('.drawer__summary')?.textContent.trim(),
        focusInside: dialog.contains(document.activeElement),
        labelled: !!document.getElementById(dialog.getAttribute('aria-labelledby')),
      };
    `);
    check('Favorites drawer opens', drawer.open, drawer);
    check('drawer separates Food and Places', drawer.groups.length === 2 && /food/i.test(drawer.groups[0]) && /places/i.test(drawer.groups[1]), drawer.groups);
    check('drawer lists both saved spots', drawer.items === 2, drawer);
    check('drawer footer summarises the counts', /2 saved/.test(drawer.summary ?? ''), drawer.summary);
    check('focus moves into the drawer', drawer.focusInside, drawer);
    check('drawer has an accessible name', drawer.labelled);

    await page.key('Escape');
    await page.wait(300);
    check('Escape closes the drawer', (await page.evaluate(`document.getElementById('favorites-drawer').open`)) === false);

    /* --- persistence across a reload --- */
    await page.evaluate(`window.location.reload(); return true;`);
    await page.wait(1900);
    const afterReload = await page.evaluate(heartState('place-old-quarter'));
    check('saved state survives a reload', afterReload.pressed.every((v) => v === 'true'), afterReload);
    check('badge still shows 2 after a reload', (await page.evaluate(badge)).text === '2');

    const errors = page.errors();
    check('no script exceptions', errors.exceptions.length === 0, errors.exceptions);
    check('no console errors', errors.console.length === 0, errors.console);
  });
}

async function checkMyDay() {
  console.log(`\n=== My Day: add, move, remove, totals, reset ===`);

  await withPage(`${base}/food.html`, { width: 1440 }, async (page) => {
    await signUp(page, { username: `md_${stamp}`, password: 'demo-pass-1' });

    await page.evaluate(`window.location.href = '/food.html'; return true;`);
    await page.wait(1800);

    /* --- add from the detail modal --- */
    await page.click('.card[data-spot-id="food-pho-bo"] .card__link');
    await page.wait(600);
    await page.evaluate(`
      const dialog = document.getElementById('spot-detail');
      dialog.querySelector('[data-role="detail-actions"] select').value = 'morning';
      dialog.querySelector('[data-role="detail-actions"] [data-action="add-to-day"]').click();
      return true;
    `);
    await page.wait(800);
    await page.key('Escape');
    await page.wait(300);

    /* --- add two more so ordering can be tested --- */
    for (const id of ['food-banh-mi', 'food-xoi-xeo']) {
      await page.click(`.card[data-spot-id="${id}"] .card__link`);
      await page.wait(500);
      await page.evaluate(`
        const dialog = document.getElementById('spot-detail');
        dialog.querySelector('[data-role="detail-actions"] select').value = 'morning';
        dialog.querySelector('[data-role="detail-actions"] [data-action="add-to-day"]').click();
        return true;
      `);
      await page.wait(700);
      await page.key('Escape');
      await page.wait(250);
    }

    await page.click('.site-nav [data-action="open-my-day"]');
    await page.wait(900);

    const opened = await page.evaluate(`
      const dialog = document.getElementById('my-day-drawer');
      return {
        open: dialog.open,
        slots: [...dialog.querySelectorAll('.plan-slot__title')].map((el) => el.textContent.trim().split(' ')[0]),
        morning: [...dialog.querySelectorAll('.plan-slot')][0].querySelectorAll('.plan-item').length,
        order: [...dialog.querySelectorAll('.plan-item__title')].map((el) => el.textContent.trim()),
        totals: dialog.querySelector('[data-role="my-day-totals"]').textContent.trim(),
      };
    `);
    check('My Day drawer opens', opened.open, opened);
    check('all three slots are shown', opened.slots.join(',') === 'Morning,Afternoon,Evening', opened.slots);
    check('three stops landed in the morning', opened.morning === 3, opened);
    check('totals report three stops', /3 stops/.test(opened.totals), opened.totals);
    check('totals show an estimated cost in VND', /about [\d,]+ VND/.test(opened.totals), opened.totals);
    check('totals explain that food is estimated', /estimated from its price level/i.test(opened.totals), opened.totals);

    /* --- move the last item up --- */
    const orderBefore = opened.order;
    await page.evaluate(`
      const items = [...document.querySelectorAll('#my-day-drawer .plan-item')];
      items[2].querySelector('button[aria-label^="Move"]').click();
      return true;
    `);
    await page.wait(900);
    const orderAfter = await page.evaluate(`[...document.querySelectorAll('#my-day-drawer .plan-item__title')].map((el) => el.textContent.trim())`);
    check('move up changes the order', orderAfter[1] === orderBefore[2], { orderBefore, orderAfter });
    check('the first item cannot move up', await page.evaluate(`
      const first = document.querySelector('#my-day-drawer .plan-item');
      return first.querySelector('button[aria-label^="Move"]').disabled;
    `));

    /* --- move an item to the afternoon via the select --- */
    await page.evaluate(`
      const item = document.querySelector('#my-day-drawer .plan-item');
      const select = item.querySelector('select');
      select.value = 'afternoon';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    `);
    await page.wait(900);
    const afterMove = await page.evaluate(`
      const slots = [...document.querySelectorAll('#my-day-drawer .plan-slot')];
      return {
        morning: slots[0].querySelectorAll('.plan-item').length,
        afternoon: slots[1].querySelectorAll('.plan-item').length,
        totals: document.querySelector('[data-role="my-day-totals"]').textContent.trim(),
      };
    `);
    check('the item moved to the afternoon', afterMove.morning === 2 && afterMove.afternoon === 1, afterMove);
    check('total stops did not change on a move', /3 stops/.test(afterMove.totals), afterMove.totals);

    /* --- remove one --- */
    await page.evaluate(`
      document.querySelector('#my-day-drawer .plan-item button[aria-label^="Remove"]').click();
      return true;
    `);
    await page.wait(900);
    check('removing an item updates the totals', /2 stops/.test(await page.evaluate(`document.querySelector('[data-role="my-day-totals"]').textContent`)));

    /* --- reset needs two clicks (DAY-05) --- */
    await page.click('[data-role="my-day-reset"] button');
    await page.wait(400);
    const confirmStep = await page.evaluate(`
      const area = document.querySelector('[data-role="my-day-reset"]');
      return {
        asks: /remove every stop/i.test(area.textContent),
        stops: document.querySelector('[data-role="my-day-totals"]').textContent.trim(),
      };
    `);
    check('the first reset click only asks for confirmation', confirmStep.asks && /2 stops/.test(confirmStep.stops), confirmStep);

    await page.evaluate(`
      const area = document.querySelector('[data-role="my-day-reset"]');
      [...area.querySelectorAll('button')].find((b) => /keep my plan/i.test(b.textContent)).click();
      return true;
    `);
    await page.wait(400);
    check('cancelling the reset keeps the plan', /2 stops/.test(await page.evaluate(`document.querySelector('[data-role="my-day-totals"]').textContent`)));

    await page.click('[data-role="my-day-reset"] button');
    await page.wait(400);
    await page.evaluate(`
      const area = document.querySelector('[data-role="my-day-reset"]');
      [...area.querySelectorAll('button')].find((b) => /yes, clear it/i.test(b.textContent)).click();
      return true;
    `);
    await page.wait(1000);
    const cleared = await page.evaluate(`({
      totals: document.querySelector('[data-role="my-day-totals"]').textContent.trim(),
      items: document.querySelectorAll('#my-day-drawer .plan-item').length,
    })`);
    check('confirming the reset clears the day', cleared.items === 0 && /no stops/i.test(cleared.totals), cleared);

    const errors = page.errors();
    check('no script exceptions', errors.exceptions.length === 0, errors.exceptions);
    check('no console errors', errors.console.length === 0, errors.console);
  });
}

async function checkLogoutHidesData() {
  console.log(`\n=== logout hides personal data (Gate 3) ===`);

  await withPage(`${base}/food.html`, { width: 1440 }, async (page) => {
    await signUp(page, { username: `lo_${stamp}`, password: 'demo-pass-1' });
    await page.evaluate(`window.location.href = '/food.html'; return true;`);
    await page.wait(1800);

    await page.click('[data-action="toggle-favorite"][data-spot-id="food-bun-cha"]');
    await page.wait(700);
    check('saved one favorite before logout', (await page.evaluate(badge)).text === '1');

    await page.click('.site-header [data-action="logout"]');
    await page.wait(1000);

    const afterLogout = await page.evaluate(`
      const heart = document.querySelector('[data-action="toggle-favorite"][data-spot-id="food-bun-cha"]');
      const badgeEl = document.querySelector('[data-role="favorite-count"]');
      return {
        auth: document.documentElement.dataset.auth,
        pressed: heart.getAttribute('aria-pressed'),
        badgeHidden: badgeEl.hidden,
      };
    `);
    check('logout resets the document to guest', afterLogout.auth === 'guest', afterLogout);
    check('hearts clear on logout', afterLogout.pressed === 'false', afterLogout);
    check('the favorites badge clears on logout', afterLogout.badgeHidden === true, afterLogout);

    await page.click('[data-action="open-favorites"]');
    await page.wait(500);
    check('the drawer is closed off after logout', await page.evaluate(`
      return document.getElementById('sign-in-prompt').open && !document.getElementById('favorites-drawer').open;
    `));

    const errors = page.errors();
    check('no script exceptions', errors.exceptions.length === 0, errors.exceptions);
  });
}

await checkFavorites();
await checkMyDay();
await checkLogoutHidesData();

/* --- cleanup ----------------------------------------------------------- */
{
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  const removed = db.prepare(`DELETE FROM users WHERE username LIKE 'dw\\_%' ESCAPE '\\' OR username LIKE 'md\\_%' ESCAPE '\\' OR username LIKE 'lo\\_%' ESCAPE '\\'`).run();
  db.close();
  console.log(`\n(cleanup: removed ${removed.changes} test accounts)`);
}

process.exit(summary() === 0 ? 0 : 1);
