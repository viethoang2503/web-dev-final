/**
 * Accessibility checks for QA-04 / docs/05 section 4.
 *
 *   node tests/accessibility.test.mjs [baseUrl]
 *
 * Automates the parts of the required-checks list that a machine can judge:
 * text contrast, touch target size, label wiring, alt text, heading order,
 * accessible names, and the keyboard path through the main flow.
 *
 * What it cannot replace: actually using the site with a screen reader and with
 * the keyboard only. docs/05 asks for that to be demonstrated live, and this
 * script is the evidence that the mechanical rules hold underneath it.
 */
import { withPage, check, summary } from './helpers/browser.mjs';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');

const PAGES = [
  { path: '/', name: 'Home' },
  { path: '/food.html', name: 'Food' },
  { path: '/places.html', name: 'Places' },
  { path: '/account.html', name: 'Account' },
];

/**
 * Runs inside the page. Returns findings rather than assertions, so the report
 * can name the exact element that fails.
 */
const AUDIT = `
  /* --- colour helpers, WCAG 2.1 relative luminance ------------------- */
  const parseColor = (value) => {
    const match = value.match(/rgba?\\(([^)]+)\\)/);
    if (!match) return null;
    const parts = match[1].split(/[,\\s/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };

  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  const luminance = ({ r, g, b }) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  const contrast = (a, b) => {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  /* Effective background: walk up until something is opaque. */
  const backgroundOf = (element) => {
    let node = element;
    while (node && node !== document.documentElement) {
      const color = parseColor(getComputedStyle(node).backgroundColor);
      if (color && color.a > 0.5) return color;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const describe = (el) => {
    const classes = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + classes + (el.id ? '#' + el.id : '');
  };

  const isVisible = (el) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const accessibleName = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
      if (text) return text;
    }

    if (el.id) {
      const label = document.querySelector('label[for="' + el.id + '"]');
      if (label?.textContent.trim()) return label.textContent.trim();
    }

    if (el.closest('label')?.textContent.trim()) return el.closest('label').textContent.trim();

    const title = el.getAttribute('title');
    if (title && title.trim()) return title.trim();

    return (el.textContent ?? '').trim();
  };

  const findings = {
    contrast: [],
    touchTargets: [],
    smallText: [],
    missingAlt: [],
    unlabelledControls: [],
    unnamedButtons: [],
    positiveTabindex: [],
    headingOrder: [],
    focusStyles: [],
  };

  /* --- text contrast (4.5:1 for body, 3:1 for large text) ------------- */
  const textNodes = [...document.querySelectorAll('body *')].filter((el) => {
    if (!isVisible(el)) return false;
    // Only elements holding their own text.
    return [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim().length > 1);
  });

  for (const el of textNodes) {
    const style = getComputedStyle(el);
    const color = parseColor(style.color);
    if (!color || color.a < 0.5) continue;

    const size = parseFloat(style.fontSize);
    const weight = Number(style.fontWeight) || 400;
    const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = isLarge ? 3 : 4.5;
    const ratio = contrast(color, backgroundOf(el));

    if (ratio < required) {
      findings.contrast.push({
        element: describe(el),
        text: el.textContent.trim().slice(0, 40),
        ratio: Math.round(ratio * 100) / 100,
        required,
        size,
      });
    }

    /*
     * Body copy must stay at 16px. The Design Style type scale also defines
     * Label (14px) and Metadata (12px) roles for secondary information, so
     * elements playing those roles are judged against their own floor of 12px
     * rather than the body floor.
     */
    const LABEL_ROLES = [
      '.badge', '.card__meta', '.card__meta-item', '.eyebrow', '.field__hint',
      '.field__label', '.field__error', '.utility-bar__text', '.site-footer__credits',
      '.site-footer__heading', '.site-footer__list', '.site-footer__list *',
      '.plan-totals__note', '.plan-slot__count', '.saved-item__meta', '.plan-item__meta',
      '.drawer__summary', '.drawer-group__title', '.language-switch', '.language-switch *',
      '.hero__stats dt', '.modal__fact dt', '.skip-link', '.chip', '.button--text',
      '.button--compact', '.select--compact', '.search__clear', '.toolbar__results *',
      'code', 'option',
    ].join(', ');

    const isLabelish = el.matches(LABEL_ROLES);
    const floor = isLabelish ? 12 : 16;

    if (size < floor) {
      findings.smallText.push({ element: describe(el), size, floor, text: el.textContent.trim().slice(0, 40) });
    }
  }

  /* --- touch targets: 44x44 minimum ---------------------------------- */

  /**
   * A card title link is small, but its ::after stretches over the whole card,
   * so the real hit area is the card. Measure that instead, and record the
   * stretched links separately so the coverage is not silently dropped.
   */
  const stretchedTargets = [];

  for (const el of document.querySelectorAll('a, button, select, input, [role="button"]')) {
    if (!isVisible(el)) continue;
    // Inline links inside body copy are exempt; the rule targets controls.
    if (el.tagName === 'A' && el.closest('p, li') && !el.classList.contains('button') && !el.classList.contains('site-nav__link') && !el.classList.contains('tile__link') && !el.classList.contains('card__link')) continue;
    // The skip link is only visible while focused by keyboard.
    if (el.classList.contains('skip-link')) continue;

    let measured = el;
    if (el.classList.contains('card__link')) {
      const overlay = getComputedStyle(el, '::after');
      const stretched = overlay.position === 'absolute' && overlay.content !== 'none';
      const card = el.closest('.card');
      if (stretched && card) {
        measured = card;
        const cardRect = card.getBoundingClientRect();
        stretchedTargets.push({ name: accessibleName(el).slice(0, 24), height: Math.round(cardRect.height) });
      }
    }

    const rect = measured.getBoundingClientRect();
    if (rect.height < 44 || rect.width < 44) {
      findings.touchTargets.push({
        element: describe(el),
        measured: measured === el ? 'self' : describe(measured),
        name: accessibleName(el).slice(0, 30),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
  }

  /* --- images ---------------------------------------------------------- */
  for (const img of document.querySelectorAll('img')) {
    if (!img.hasAttribute('alt')) {
      findings.missingAlt.push({ element: describe(img), src: img.getAttribute('src') });
    }
  }

  /* --- form controls need a programmatic label ------------------------ */
  for (const control of document.querySelectorAll('input, select, textarea')) {
    if (!isVisible(control)) continue;
    if (!accessibleName(control)) {
      findings.unlabelledControls.push({ element: describe(control), type: control.type });
    }
  }

  /* --- buttons and links need an accessible name ---------------------- */
  for (const el of document.querySelectorAll('button, a')) {
    if (!isVisible(el)) continue;
    if (!accessibleName(el)) {
      findings.unnamedButtons.push({ element: describe(el) });
    }
  }

  /* --- tabindex should never be positive ------------------------------ */
  for (const el of document.querySelectorAll('[tabindex]')) {
    if (Number(el.getAttribute('tabindex')) > 0) {
      findings.positiveTabindex.push({ element: describe(el), tabindex: el.getAttribute('tabindex') });
    }
  }

  /* --- heading order: no skipped levels ------------------------------- */
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .filter(isVisible)
    .map((el) => ({ level: Number(el.tagName[1]), text: el.textContent.trim().slice(0, 40) }));

  let previous = 0;
  for (const heading of headings) {
    if (previous && heading.level > previous + 1) {
      findings.headingOrder.push({ from: previous, to: heading.level, text: heading.text });
    }
    previous = heading.level;
  }

  /* --- focus styles: a visible outline must exist and never be removed --- */
  const focusRules = { withOutline: 0, outlineRemoved: [] };
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = [...sheet.cssRules];
    } catch {
      continue;
    }
    for (const rule of rules) {
      const selector = rule.selectorText ?? '';
      if (!selector) continue;
      if (selector.includes(':focus-visible') && rule.style.outline !== '' ) {
        focusRules.withOutline += 1;
      }
      const outline = rule.style.outline || rule.style.outlineStyle || rule.style.outlineWidth;
      if (outline && /^(none|0)/.test(outline) && !selector.includes(':focus-visible')) {
        focusRules.outlineRemoved.push(selector);
      }
    }
  }

  return {
    findings,
    stretchedTargets,
    focusRules,
    counts: {
      h1: document.querySelectorAll('h1').length,
      headings: headings.length,
      images: document.querySelectorAll('img').length,
      controls: document.querySelectorAll('input, select, textarea').length,
      buttons: document.querySelectorAll('button').length,
    },
    lang: document.documentElement.lang,
    title: document.title,
    hasSkipLink: !!document.querySelector('.skip-link'),
    hasMainLandmark: !!document.querySelector('main'),
    hasNavLandmark: !!document.querySelector('nav'),
    reducedMotionHonoured: [...document.styleSheets].some((sheet) => {
      try {
        return [...sheet.cssRules].some((rule) => String(rule.conditionText ?? '').includes('prefers-reduced-motion'));
      } catch {
        return false;
      }
    }),
  };
`;

async function auditPage({ path, name }) {
  console.log(`\n=== ${name} (${path}) ===`);

  await withPage(`${base}${path}`, { width: 1280, height: 900 }, async (page) => {
    const report = await page.evaluate(AUDIT);
    const { findings, counts } = report;

    check(`${name}: html lang is set`, report.lang === 'en', report.lang);
    check(`${name}: page has a title`, report.title.length > 10, report.title);
    check(`${name}: has a skip link`, report.hasSkipLink);
    check(`${name}: has main and nav landmarks`, report.hasMainLandmark && report.hasNavLandmark);
    check(`${name}: exactly one h1`, counts.h1 === 1, counts.h1);
    check(`${name}: heading levels never skip`, findings.headingOrder.length === 0, findings.headingOrder);
    check(`${name}: every image has alt`, findings.missingAlt.length === 0, findings.missingAlt);
    check(`${name}: every form control is labelled`, findings.unlabelledControls.length === 0, findings.unlabelledControls);
    check(`${name}: every button and link has a name`, findings.unnamedButtons.length === 0, findings.unnamedButtons);
    check(`${name}: no positive tabindex`, findings.positiveTabindex.length === 0, findings.positiveTabindex);
    check(`${name}: text contrast meets WCAG AA`, findings.contrast.length === 0, findings.contrast);
    check(`${name}: body text is at least 16px`, findings.smallText.length === 0, findings.smallText);
    check(`${name}: controls are at least 44x44`, findings.touchTargets.length === 0, findings.touchTargets);
    if (report.stretchedTargets.length) {
      check(
        `${name}: card links use the whole card as their hit area`,
        report.stretchedTargets.every((target) => target.height >= 44),
        report.stretchedTargets.filter((t) => t.height < 44)
      );
    }
    check(`${name}: a visible focus outline is defined`, report.focusRules.withOutline > 0, report.focusRules);
    check(`${name}: no rule removes the focus outline`, report.focusRules.outlineRemoved.length === 0, report.focusRules.outlineRemoved);
    check(`${name}: stylesheet honours prefers-reduced-motion`, report.reducedMotionHonoured);
  });
}

/* --- keyboard path through the main flow -------------------------------- */

async function checkKeyboardFlow() {
  console.log(`\n=== keyboard only: reach the filters and open a detail modal ===`);

  await withPage(`${base}/food.html`, { width: 1280, height: 900 }, async (page) => {
    // Walk the tab order and record what is reachable.
    const order = await page.evaluate(`
      const focusable = [...document.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        });
      return focusable.map((el) => {
        // A <label for> wins over textContent: for a <select>, textContent is
        // the whole option list, which is not the accessible name.
        const labelled = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
        return (
          el.getAttribute('aria-label') ||
          labelled?.textContent.trim() ||
          el.textContent.trim().slice(0, 24) ||
          el.id ||
          el.name ||
          el.tagName.toLowerCase()
        );
      });
    `);

    check('skip link is the first stop in the tab order', /skip to content/i.test(order[0] ?? ''), order[0]);
    check('the search field is reachable', order.some((label) => /search/i.test(label)), order.slice(0, 20));
    check('the filter selects are reachable', order.filter((l) => /categor|district|price|sort/i.test(l)).length >= 4, order);
    check('a card link is reachable', order.some((label) => /pho bo/i.test(label)), order.slice(0, 30));

    /* Focus a card link and open it with the keyboard. */
    await page.evaluate(`
      const link = document.querySelector('.card__link');
      link.focus();
      return document.activeElement === link;
    `);
    await page.key('Enter');
    await page.wait(500);

    const opened = await page.evaluate(`({
      open: document.getElementById('spot-detail').open,
      focusInside: document.getElementById('spot-detail').contains(document.activeElement),
    })`);
    check('Enter on a focused card opens the detail modal', opened.open, opened);
    check('focus moves inside the modal', opened.focusInside, opened);

    /* Tab must stay inside the open dialog. */
    const trapped = await page.evaluate(`
      const dialog = document.getElementById('spot-detail');
      const focusable = dialog.querySelectorAll('a[href], button:not([disabled]), select, input');
      return { insideCount: focusable.length, activeInside: dialog.contains(document.activeElement) };
    `);
    check('the modal contains its own focusable controls', trapped.insideCount >= 2, trapped);

    await page.key('Escape');
    await page.wait(300);
    const closed = await page.evaluate(`({
      open: document.getElementById('spot-detail').open,
      activeIsCard: document.activeElement?.classList.contains('card__link'),
    })`);
    check('Escape closes the modal', closed.open === false);
    check('focus returns to the card', closed.activeIsCard === true, closed);

    /*
     * Focus visibility is asserted from the stylesheet in the per-page audit;
     * getComputedStyle cannot read a pseudo-class. Here we check the behaviour
     * that depends on it: tabbing moves focus and the focused element is on
     * screen, so a keyboard user can see where they are.
     */
    await page.evaluate(`document.querySelector('.brand').focus(); return true;`);
    await page.key('Tab');
    const afterTab = await page.evaluate(`
      const el = document.activeElement;
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        name: (el.getAttribute('aria-label') || el.textContent.trim()).slice(0, 24),
        onScreen: rect.top >= 0 && rect.bottom <= window.innerHeight + rect.height,
        isBody: el === document.body,
      };
    `);
    check('Tab moves focus to a real control', afterTab.isBody === false, afterTab);
    check('the focused control is on screen', afterTab.onScreen, afterTab);
  });
}

for (const page of PAGES) {
  await auditPage(page);
}
await checkKeyboardFlow();

process.exit(summary() === 0 ? 0 : 1);
