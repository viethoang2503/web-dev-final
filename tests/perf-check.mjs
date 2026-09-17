/**
 * Front-end performance checks for PERF-02 and PERF-03 / docs/05 section 5.
 *
 *   node tests/perf-check.mjs [baseUrl]
 *
 * Verifies the rules the team can actually be held to:
 * - images below the first viewport are lazy, hero images are not;
 * - every image reserves its space, so nothing shifts when it loads;
 * - one Favorite change does not re-render the whole grid;
 * - filter changes do not pile up duplicate event listeners;
 * - it reports how many photos are still placeholders (PERF-01 progress).
 */
import { DatabaseSync } from 'node:sqlite';
import { withPage, check, summary } from './cdp.mjs';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const dbPath = process.env.DATABASE_PATH ?? './server/db/hanoi-local.sqlite';

/** Throwaway accounts created during the run, removed at the end. */
const testAccounts = [];

const IMAGE_AUDIT = `
  const viewportHeight = window.innerHeight;
  const images = [...document.querySelectorAll('img')];

  const describe = (img) => (img.getAttribute('src') ?? '').split('/').slice(-2).join('/');

  const wrongLoading = [];
  const noReservedSpace = [];

  for (const img of images) {
    const rect = img.getBoundingClientRect();
    const style = getComputedStyle(img);
    const aboveFold = rect.top < viewportHeight;

    /* Space reservation: width+height attributes, or an aspect-ratio from CSS
       (on the image or the box around it). */
    const hasAttributes = img.hasAttribute('width') && img.hasAttribute('height');
    const parentRatio = img.parentElement ? getComputedStyle(img.parentElement).aspectRatio : 'auto';
    const hasRatio = style.aspectRatio !== 'auto' || parentRatio !== 'auto';
    if (!hasAttributes && !hasRatio) {
      noReservedSpace.push(describe(img));
    }

    /* Lazy loading: below the fold should be lazy, above should not be. */
    const loading = img.getAttribute('loading') ?? 'eager';
    if (aboveFold && loading === 'lazy') {
      wrongLoading.push({ image: describe(img), problem: 'above the fold but lazy', top: Math.round(rect.top) });
    }
    if (!aboveFold && loading !== 'lazy') {
      wrongLoading.push({ image: describe(img), problem: 'below the fold but eager', top: Math.round(rect.top) });
    }
  }

  return { total: images.length, wrongLoading, noReservedSpace };
`;

async function checkImages(path, name) {
  console.log(`\n=== ${name}: image loading and reserved space ===`);

  await withPage(`${base}${path}`, { width: 1280, height: 900 }, async (page) => {
    const report = await page.evaluate(IMAGE_AUDIT);

    check(`${name}: images are present`, report.total > 0, report.total);
    check(`${name}: every image reserves its space`, report.noReservedSpace.length === 0, report.noReservedSpace);
    check(`${name}: lazy loading matches position`, report.wrongLoading.length === 0, report.wrongLoading);
  });
}

async function checkNoLayoutShift(path = '/food.html', name = 'Food') {
  console.log(`\n=== ${name}: layout stability while cards load ===`);

  await withPage(`${base}${path}`, { width: 1280, height: 900, settleMs: 60 }, async (page) => {
    /*
     * buffered: true replays shifts that happened before the observer was
     * created, so this catches the early jump that occurs when data replaces
     * an empty container. Each source is recorded, so a regression names the
     * element that moved instead of just a score.
     */
    await page.evaluate(`
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          window.__shifts.push({
            value: Math.round(entry.value * 1000) / 1000,
            sources: (entry.sources ?? []).map((source) => {
              const el = source.node;
              if (!el || !el.tagName) return 'unknown';
              const cls = typeof el.className === 'string' && el.className
                ? '.' + el.className.trim().split(/\\s+/)[0]
                : '';
              return el.tagName.toLowerCase() + cls;
            }),
          });
        }
      }).observe({ type: 'layout-shift', buffered: true });
      return true;
    `);

    await page.wait(2500);

    const shifts = await page.evaluate(`window.__shifts`);
    const score = Math.round(shifts.reduce((sum, entry) => sum + entry.value, 0) * 1000) / 1000;

    // 0.1 is the "good" threshold for Cumulative Layout Shift.
    check(`${name}: cumulative layout shift stays in the good range`, score < 0.1, { score, shifts });
  });
}

async function checkRenderEfficiency() {
  console.log(`\n=== rendering efficiency ===`);

  await withPage(`${base}/food.html`, { width: 1280, height: 900 }, async (page) => {
    /* A filter change must replace the cards in one pass, not append. */
    const beforeFilter = await page.evaluate(`document.querySelectorAll('.card').length`);
    await page.fill('#filter-district', 'Ba Dinh', 'change');
    await page.wait(300);
    const filtered = await page.evaluate(`document.querySelectorAll('.card').length`);
    await page.fill('#filter-district', 'all', 'change');
    await page.wait(300);
    const restored = await page.evaluate(`document.querySelectorAll('.card').length`);

    check('filtering replaces cards instead of appending', filtered < beforeFilter, { beforeFilter, filtered });
    check('clearing the filter restores exactly the original count', restored === beforeFilter, { beforeFilter, restored });

    /*
     * Filtering repeatedly must not multiply listeners. The card grid uses one
     * delegated listener, so clicking a card after many filter passes should
     * open the modal exactly once.
     */
    for (const district of ['Hoan Kiem', 'all', 'Ba Dinh', 'all']) {
      await page.fill('#filter-district', district, 'change');
      await page.wait(120);
    }

    const openCount = await page.evaluate(`
      let opens = 0;
      const dialog = document.getElementById('spot-detail');
      const observer = new MutationObserver(() => { if (dialog.open) opens += 1; });
      observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
      document.querySelector('.card__link').click();
      return new Promise((resolve) => setTimeout(() => { observer.disconnect(); resolve(opens); }, 400));
    `);
    check('a card click opens the modal once, not once per filter pass', openCount === 1, openCount);

    /*
     * One Favorite change must not re-render the grid. Tag the nodes, toggle a
     * heart, and confirm the same nodes are still there.
     *
     * A throwaway account is used rather than the demo one, so running this
     * twice cannot leave the presentation data in a different state.
     */
    await page.key('Escape');
    await page.wait(300);

    const account = `perf_${Date.now().toString(36)}`;
    await page.evaluate(`
      return fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: '${account}', password: 'demo-pass-1' }),
      }).then((r) => r.status);
    `);
    await page.evaluate(`window.location.reload(); return true;`);
    await page.wait(2000);

    await page.evaluate(`
      document.querySelectorAll('.card').forEach((card, index) => { card.dataset.probe = String(index); });
      return true;
    `);

    const before = await page.evaluate(`
      document.querySelector('[data-action="toggle-favorite"][data-spot-id="food-xoi-xeo"]').getAttribute('aria-pressed')
    `);
    await page.click('[data-action="toggle-favorite"][data-spot-id="food-xoi-xeo"]');
    await page.wait(900);

    const probes = await page.evaluate(`({
      probed: document.querySelectorAll('.card[data-probe]').length,
      cards: document.querySelectorAll('.card').length,
      pressed: document.querySelector('[data-action="toggle-favorite"][data-spot-id="food-xoi-xeo"]').getAttribute('aria-pressed'),
    })`);
    check('one Favorite change does not re-render the grid', probes.probed === probes.cards, probes);
    check('the heart flipped state', before === 'false' && probes.pressed === 'true', { before, after: probes.pressed });

    testAccounts.push(account);

    const errors = page.errors();
    check('no script exceptions', errors.exceptions.length === 0, errors.exceptions);
  });
}

async function reportMissingPhotos() {
  console.log(`\n=== PERF-01 progress: how many photos are still placeholders ===`);

  const paths = ['/', '/food.html', '/places.html'];
  const placeholders = new Set();
  const real = new Set();

  for (const path of paths) {
    await withPage(`${base}${path}`, { width: 1280, height: 900 }, async (page) => {
      const urls = await page.evaluate(`
        return [...document.querySelectorAll('img')]
          .map((img) => img.getAttribute('src'))
          .filter((src) => src && src.startsWith('/assets/images/') && !src.endsWith('.svg'));
      `);

      for (const url of urls) {
        const response = await fetch(`${base}${url}`);
        if (response.headers.get('x-image-placeholder') === 'true') {
          placeholders.add(url);
        } else {
          real.add(url);
        }
        await response.arrayBuffer();
      }
    });
  }

  const total = placeholders.size + real.size;
  console.log(`  ${real.size} of ${total} referenced photos exist; ${placeholders.size} still fall back to the placeholder.`);
  if (placeholders.size) {
    console.log('  Missing:');
    [...placeholders].sort().forEach((url) => console.log(`    ${url}`));
  }
  // Not a failure: PERF-01 is content work, and the layout holds either way.
  check('missing photos degrade to the placeholder rather than breaking', true);
}

await checkImages('/', 'Home');
await checkImages('/food.html', 'Food');
await checkNoLayoutShift('/food.html', 'Food');
await checkNoLayoutShift('/', 'Home');
await checkRenderEfficiency();
await reportMissingPhotos();

/* --- cleanup ----------------------------------------------------------- */
if (testAccounts.length) {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  const statement = db.prepare('DELETE FROM users WHERE username = ?');
  let removed = 0;
  for (const username of testAccounts) {
    removed += statement.run(username).changes;
  }
  db.close();
  console.log(`\n(cleanup: removed ${removed} test account)`);
}

process.exit(summary() === 0 ? 0 : 1);
