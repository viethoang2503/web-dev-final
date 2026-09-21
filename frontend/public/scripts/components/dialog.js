/**
 * modal.js - dialog and drawer plumbing (UI-04).
 *
 * Built on the native <dialog> element with showModal(), which gives us the
 * behaviour the Design Style spec asks for without hand-rolling it:
 * - focus is trapped inside the dialog while it is open;
 * - Escape closes it;
 * - focus returns to the element that opened it;
 * - ::backdrop is styleable and the rest of the page is inert.
 *
 * We add on top: click-on-backdrop to close, scroll lock, and one place that
 * renders the shared Food/Place detail content.
 */
import { formatAdmission, formatDuration, formatPriceLevel } from './spot-card.js';

const DIALOG_SELECTOR = 'dialog';

/** Remembers who opened each dialog so focus can go back there. */
const lastTrigger = new WeakMap();

/**
 * Wire a dialog once. Safe to call again; it will not double-bind.
 *
 * @param {HTMLDialogElement} dialog
 */
export function initDialog(dialog) {
  if (!dialog || dialog.dataset.dialogReady === 'true') return dialog;
  dialog.dataset.dialogReady = 'true';

  // Any element with data-action="close-dialog" closes its own dialog.
  dialog.addEventListener('click', (event) => {
    const closer = event.target.closest('[data-action="close-dialog"]');
    if (closer && dialog.contains(closer)) {
      closeDialog(dialog);
      return;
    }

    // Clicking the backdrop: the event target is the dialog itself, because
    // all real content lives in a wrapper element inside it.
    if (event.target === dialog) {
      closeDialog(dialog);
    }
  });

  dialog.addEventListener('close', () => {
    document.documentElement.style.removeProperty('overflow');

    const trigger = lastTrigger.get(dialog);
    lastTrigger.delete(dialog);
    if (!trigger?.isConnected) return;

    // The browser restores focus by itself when the trigger had focus to begin
    // with. It cannot when the dialog was opened programmatically, or when the
    // trigger was re-rendered by a filter change. Check after the browser has
    // had its turn, and only step in when focus was actually lost.
    requestAnimationFrame(() => {
      const active = document.activeElement;
      const focusWasLost = !active || active === document.body || dialog.contains(active);
      if (focusWasLost) {
        trigger.focus();
      }
    });
  });

  return dialog;
}

/** Wire every dialog on the page. Called once per page script. */
export function initDialogs(root = document) {
  root.querySelectorAll(DIALOG_SELECTOR).forEach(initDialog);
}

/**
 * Open a dialog modally.
 *
 * @param {HTMLDialogElement} dialog
 * @param {{ trigger?: HTMLElement, focus?: string }} [options]
 *        trigger: element to return focus to
 *        focus:   selector inside the dialog to focus first
 */
export function openDialog(dialog, { trigger, focus } = {}) {
  if (!dialog) return;
  initDialog(dialog);

  if (dialog.open) return;

  lastTrigger.set(dialog, trigger ?? document.activeElement);
  // Stop the page behind the dialog from scrolling.
  document.documentElement.style.overflow = 'hidden';
  dialog.showModal();

  const target = focus ? dialog.querySelector(focus) : null;
  if (target) {
    target.focus();
  }
}

export function closeDialog(dialog) {
  if (dialog?.open) {
    dialog.close();
  }
}

/* ==========================================================================
   Shared Food / Place detail content (PLACE-04)
   Used by Home, Food and Places so there is one detail view, not three.
   ========================================================================== */

const PLACEHOLDER_IMAGE = '/assets/images/placeholder.svg';

function fact(term, value) {
  if (!value) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'modal__fact';
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = value;
  wrapper.append(dt, dd);
  return wrapper;
}

/** Google Maps search link. External map only, no embedded API (F1). */
function mapsUrl(spot) {
  const query = [spot.name, spot.address, 'Hanoi'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Fill a detail dialog with one spot and open it.
 *
 * @param {HTMLDialogElement} dialog  markup from the page's <dialog> template
 * @param {object} spot               record from the API
 * @param {{ trigger?: HTMLElement }} [options]
 */
export function openSpotDetail(dialog, spot, { trigger } = {}) {
  const image = dialog.querySelector('[data-role="detail-image"]');
  const eyebrow = dialog.querySelector('[data-role="detail-eyebrow"]');
  const title = dialog.querySelector('[data-role="detail-title"]');
  const description = dialog.querySelector('[data-role="detail-description"]');
  const facts = dialog.querySelector('[data-role="detail-facts"]');
  const tip = dialog.querySelector('[data-role="detail-tip"]');
  const mapLink = dialog.querySelector('[data-role="detail-map"]');

  image.src = spot.image ?? PLACEHOLDER_IMAGE;
  image.alt = spot.name;
  image.addEventListener(
    'error',
    () => {
      image.src = PLACEHOLDER_IMAGE;
    },
    { once: true }
  );

  eyebrow.textContent = `${spot.kind === 'food' ? 'Local food' : 'Place'} · ${spot.category}`;
  title.textContent = spot.name;

  // description holds 1-2 paragraphs separated by a blank line.
  description.replaceChildren(
    ...String(spot.description ?? '')
      .split('\n\n')
      .filter(Boolean)
      .map((text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        return paragraph;
      })
  );

  const priceOrAdmission =
    spot.kind === 'food' ? formatPriceLevel(spot.priceLevel) : formatAdmission(spot.admission);

  facts.replaceChildren(
    ...[
      fact('District', spot.district),
      fact('Address', spot.address),
      fact('Opening hours', spot.openingHours),
      fact(spot.kind === 'food' ? 'Price' : 'Admission', priceOrAdmission),
      fact('Suggested visit', formatDuration(spot.durationMinutes)),
      fact('Rating', typeof spot.rating === 'number' ? `${spot.rating.toFixed(1)} / 5` : null),
    ].filter(Boolean)
  );

  if (spot.localTip) {
    tip.hidden = false;
    tip.textContent = `Local tip: ${spot.localTip}`;
  } else {
    tip.hidden = true;
  }

  mapLink.href = mapsUrl(spot);
  mapLink.textContent = 'Open in Google Maps';

  // Favorite toggle and the My Day slot picker, built by the modules that own
  // them. The modal only provides the slot in the layout.
  const actions = dialog.querySelector('[data-role="detail-actions"]');
  if (actions) {
    actions.replaceChildren();

    if (typeof detailActionBuilders.favoriteButton === 'function') {
      actions.append(detailActionBuilders.favoriteButton(spot));
    }
    if (typeof detailActionBuilders.slotPicker === 'function') {
      actions.append(detailActionBuilders.slotPicker(spot));
    }
  }

  dialog.dataset.spotId = spot.id;
  openDialog(dialog, { trigger, focus: '[data-role="detail-close"]' });
}

/**
 * Registered by the page script so modal.js does not have to import
 * favorites.js or itinerary.js (both of which already import this module).
 *
 * @type {{ favoriteButton?: (spot: object) => Node, slotPicker?: (spot: object) => Node }}
 */
export const detailActionBuilders = {};

export function registerDetailActions(builders) {
  Object.assign(detailActionBuilders, builders);
}
