/** Home chỉ tải vài mục nổi bật. Ba tour mẫu nằm trong guide.js. */
import { loadSpots, TOURS } from '../shared/guide.js';
import { el, link, picture } from '../shared/ui.js';

function feature(spot, href) {
  const card = el('article', 'home-feature');
  card.append(picture(spot.image, spot.name));
  const body = el('div', 'home-feature__body');
  body.append(el('p', 'eyebrow', spot.kind === 'food' ? 'Eat & drink' : 'See & do'));
  body.append(link(spot.name, href, 'home-feature__title'));
  body.append(el('p', '', spot.shortDescription));
  card.append(body);
  return card;
}

async function init() {
  const tourGrid = document.querySelector('[data-role="tour-grid"]');
  if (tourGrid) {
    TOURS.forEach((tour) => {
      const card = link('', `/plan.html?tour=${encodeURIComponent(tour.id)}`, 'home-tour');
      card.append(picture(tour.image, ''));
      const copy = el('span', 'home-tour__copy');
      copy.append(el('strong', '', tour.title), el('small', '', tour.description));
      card.append(copy);
      tourGrid.append(card);
    });
  }

  try {
    const spots = await loadSpots();
    const food = spots.filter((spot) => spot.kind === 'food').slice(0, 4);
    const places = spots.filter((spot) => spot.kind === 'place').slice(0, 3);
    document.querySelector('[data-role="food-grid"]')?.replaceChildren(...food.map((spot) => feature(spot, `/food.html#${spot.id}`)));
    document.querySelector('[data-role="places-grid"]')?.replaceChildren(...places.map((spot) => feature(spot, `/places.html#${spot.id}`)));
  } catch (error) {
    for (const grid of document.querySelectorAll('[data-role="food-grid"], [data-role="places-grid"]')) {
      grid.textContent = error.message;
    }
  }
}

init();
