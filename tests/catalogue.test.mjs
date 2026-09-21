/**
 * Functional check for the catalogue pages, matching the test matrix in
 * docs/05-testing-and-scoring.md section 2.
 *
 *   node tests/catalogue.test.mjs [baseUrl]
 *
 * Covers: search is case-insensitive, combined filters use AND logic, sorting
 * keeps filters, empty state offers a recovery action, clear filters restores
 * the full list, the detail modal opens and closes with Escape, and focus goes
 * back to the card that opened it.
 */
import { withPage, check, summary } from './helpers/browser.mjs';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');

const cardTitles = `[...document.querySelectorAll('.card__title')].map((el) => el.textContent.trim())`;
const cardCount = `document.querySelectorAll('.card').length`;
const resultText = `document.querySelector('[data-role="result-count"]').textContent.trim()`;

async function checkFoodPage() {
  console.log(`\n=== ${base}/food.html — search, filter, sort ===`);

  await withPage(`${base}/food.html`, { width: 1440 }, async (page) => {
    check('10 food cards on load', (await page.evaluate(cardCount)) === 10);
    check('result count shows the full list', (await page.evaluate(resultText)).includes('all 10'));
    check('Clear filters starts disabled', await page.evaluate(`document.querySelector('[data-action="clear-filters"]').disabled`));

    /* --- search, upper case on purpose --- */
    await page.fill('#filter-search', 'PHO');
    await page.wait(150);
    const searchTitles = await page.evaluate(cardTitles);
    check('search "PHO" is case-insensitive', searchTitles.length === 2 && searchTitles.every((t) => t.toLowerCase().includes('pho')), searchTitles);
    check('Clear filters became enabled', !(await page.evaluate(`document.querySelector('[data-action="clear-filters"]').disabled`)));

    /* --- inline clear button --- */
    await page.click('[data-action="clear-search"]');
    await page.wait(150);
    check('clear search restores 10 cards', (await page.evaluate(cardCount)) === 10);

    /* --- AND logic: district + price --- */
    await page.fill('#filter-district', 'Ba Dinh', 'change');
    await page.wait(120);
    const districtCount = await page.evaluate(cardCount);
    await page.fill('#filter-price', '2', 'change');
    await page.wait(120);
    const bothCount = await page.evaluate(cardCount);
    const bothMatch = await page.evaluate(`
      return [...document.querySelectorAll('.card__meta')].every((meta) => {
        const text = meta.textContent;
        return text.includes('Ba Dinh') && text.includes('$$');
      });
    `);
    check('district filter narrows the list', districtCount > 0 && districtCount < 10, districtCount);
    check('district + price uses AND logic', bothCount > 0 && bothCount <= districtCount && bothMatch, { districtCount, bothCount });

    /* --- sorting keeps the active filters --- */
    await page.fill('#filter-sort', 'rating', 'change');
    await page.wait(120);
    check('changing sort keeps filters applied', (await page.evaluate(cardCount)) === bothCount);

    /* --- empty state --- */
    await page.fill('#filter-search', 'zzzz');
    await page.wait(150);
    const emptyState = await page.evaluate(`
      const state = document.querySelector('[data-role="status"]');
      return {
        visible: state && !state.hidden,
        text: state?.textContent.trim() ?? '',
        hasClear: !!state?.querySelector('button'),
        cards: document.querySelectorAll('.card').length,
      };
    `);
    check('no match shows an empty state', emptyState.visible && emptyState.cards === 0, emptyState);
    check('empty state offers Clear filters', emptyState.hasClear);

    /* --- clear filters restores everything, including order --- */
    await page.click('[data-action="clear-filters"]');
    await page.wait(200);
    const restored = await page.evaluate(`
      return {
        cards: document.querySelectorAll('.card').length,
        first: document.querySelector('.card__title')?.textContent.trim(),
        sort: document.querySelector('#filter-sort').value,
        district: document.querySelector('#filter-district').value,
        search: document.querySelector('#filter-search').value,
        clearDisabled: document.querySelector('[data-action="clear-filters"]').disabled,
      };
    `);
    check('clear filters restores all 10 cards', restored.cards === 10, restored);
    check('clear filters resets every control', restored.sort === 'recommended' && restored.district === 'all' && restored.search === '', restored);
    check('clear filters restores initial order', restored.first === 'Pho Bo', restored.first);
    check('Clear filters disabled again', restored.clearDisabled);

    /* --- sorting correctness --- */
    await page.fill('#filter-sort', 'price-asc', 'change');
    await page.wait(150);
    const priceOrder = await page.evaluate(`
      return [...document.querySelectorAll('.card__meta')].map((meta) => {
        const match = meta.textContent.match(/\\$+/);
        return match ? match[0].length : 0;
      });
    `);
    check('price ascending is non-decreasing', priceOrder.every((value, index, all) => index === 0 || all[index - 1] <= value), priceOrder);

    const errors = page.errors();
    check('no script exceptions', errors.exceptions.length === 0, errors.exceptions);
    check('no console errors besides missing photos', errors.console.length === 0, errors.console);
  });
}

async function checkPlacesPage() {
  console.log(`\n=== ${base}/places.html — places filters ===`);

  await withPage(`${base}/places.html`, { width: 1440 }, async (page) => {
    check('10 place cards on load', (await page.evaluate(cardCount)) === 10);

    await page.fill('#filter-admission', 'free', 'change');
    await page.wait(150);
    const freeOnly = await page.evaluate(`
      return [...document.querySelectorAll('.card')].map((card) => card.querySelector('.card__meta').textContent.includes('Free entry'));
    `);
    check('free admission filter returns only free places', freeOnly.length > 0 && freeOnly.every(Boolean), freeOnly);

    await page.fill('#filter-duration', 'short', 'change');
    await page.wait(150);
    const shortVisits = await page.evaluate(`
      return [...document.querySelectorAll('.card__meta')].map((meta) => meta.textContent);
    `);
    check('free + short duration uses AND logic', shortVisits.every((text) => text.includes('Free entry')), shortVisits);

    await page.click('[data-action="clear-filters"]');
    await page.wait(150);
    check('clear filters restores 10 places', (await page.evaluate(cardCount)) === 10);

    const errors = page.errors();
    check('no script exceptions', errors.exceptions.length === 0, errors.exceptions);
    check('no console errors besides missing photos', errors.console.length === 0, errors.console);
  });
}

async function checkDetailModal() {
  console.log(`\n=== ${base}/places.html — detail modal keyboard behaviour ===`);

  await withPage(`${base}/places.html`, { width: 1440 }, async (page) => {
    await page.evaluate(`
      const link = document.querySelector('.card__link');
      link.id = 'first-card-link';
      link.click();
      return true;
    `);
    await page.wait(400);

    const opened = await page.evaluate(`
      const dialog = document.getElementById('spot-detail');
      return {
        open: dialog.open,
        title: dialog.querySelector('[data-role="detail-title"]').textContent.trim(),
        facts: dialog.querySelectorAll('.modal__fact').length,
        hasMapLink: dialog.querySelector('[data-role="detail-map"]').href.includes('google.com/maps'),
        mapRel: dialog.querySelector('[data-role="detail-map"]').rel,
        activeInsideDialog: dialog.contains(document.activeElement),
        labelled: !!document.getElementById(dialog.getAttribute('aria-labelledby')),
      };
    `);
    check('modal opens with the right record', opened.open && opened.title.length > 0, opened);
    check('modal shows the detail facts', opened.facts >= 4, opened.facts);
    check('modal has an accessible name', opened.labelled);
    check('focus moves into the dialog', opened.activeInsideDialog);
    check('map link opens Google Maps safely', opened.hasMapLink && opened.mapRel.includes('noopener'), opened.mapRel);

    /* Escape closes and focus returns to the card that opened it. */
    await page.key('Escape');
    await page.wait(250);
    const closed = await page.evaluate(`
      return {
        open: document.getElementById('spot-detail').open,
        activeId: document.activeElement?.id ?? document.activeElement?.tagName,
      };
    `);
    check('Escape closes the modal', closed.open === false);
    check('focus returns to the triggering card', closed.activeId === 'first-card-link', closed);

    /* Reopen and close with the button. */
    await page.click('#first-card-link');
    await page.wait(300);
    await page.click('[data-role="detail-close"]');
    await page.wait(250);
    check('close button closes the modal', (await page.evaluate(`document.getElementById('spot-detail').open`)) === false);

    const errors = page.errors();
    check('no script exceptions', errors.exceptions.length === 0, errors.exceptions);
  });
}

async function checkGuestPrompt() {
  console.log(`\n=== ${base}/food.html — guest prompt instead of silent failure ===`);

  await withPage(`${base}/food.html`, { width: 1440 }, async (page) => {
    await page.click('[data-action="toggle-favorite"]');
    await page.wait(300);
    const prompt = await page.evaluate(`
      const dialog = document.getElementById('sign-in-prompt');
      return { open: dialog.open, text: dialog.textContent.replace(/\\s+/g, ' ').trim().slice(0, 80) };
    `);
    check('guest clicking the heart gets a sign-in prompt', prompt.open, prompt);

    await page.key('Escape');
    await page.wait(200);
    check('prompt closes with Escape', (await page.evaluate(`document.getElementById('sign-in-prompt').open`)) === false);
  });
}

await checkFoodPage();
await checkPlacesPage();
await checkDetailModal();
await checkGuestPrompt();

process.exit(summary() === 0 ? 0 : 1);
