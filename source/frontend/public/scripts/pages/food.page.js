import { ORIGINS, approxKm, loadSpots, mapsDirections, readFavorites, readTrip, saveTrip, sortedVenues, toggleFavorite } from '../shared/guide.js';
import { el, link, picture } from '../shared/ui.js';

const search = document.querySelector('#food-search');
const originSelect = document.querySelector('#food-origin');
const grid = document.querySelector('#food-list');
const count = document.querySelector('#food-count');
let foods = [];

for (const origin of ORIGINS) {
  const option = el('option', '', origin.name);
  option.value = origin.id;
  originSelect.append(option);
}
originSelect.value = readTrip().originId;

function renderFood() {
  const origin = ORIGINS.find((item) => item.id === originSelect.value) ?? ORIGINS[0];
  const searchText = search.value.trim().toLocaleLowerCase('vi');
  const shown = foods.filter((food) => food.name.toLocaleLowerCase('vi').includes(searchText));
  count.textContent = `${shown.length} dishes`;
  const saved = new Set(readFavorites());
  grid.replaceChildren(...shown.map((food) => {
    const card = el('article', 'guide-card');
    card.id = food.id;
    card.append(picture(food.image, food.name, 'guide-card__photo'));
    const copy = el('div', 'guide-card__copy');
    copy.append(el('p', 'eyebrow', food.category), el('h2', '', food.name), el('p', '', food.shortDescription));
    const fav = el('button', 'text-action', saved.has(food.id) ? '♥ Saved dish' : '♡ Save dish');
    fav.type = 'button';
    fav.setAttribute('aria-pressed', String(saved.has(food.id)));
    fav.addEventListener('click', () => {
      const active = toggleFavorite(food.id);
      fav.textContent = active ? '♥ Saved dish' : '♡ Save dish';
      fav.setAttribute('aria-pressed', String(active));
    });
    copy.append(fav, el('h3', 'guide-card__venues-title', 'Where to try it'));
    const venues = el('ol', 'venue-list');
    for (const venue of sortedVenues(food, origin)) {
      const row = el('li', 'venue-row');
      const actions = el('div', 'venue-row__actions');
      actions.append(
        link('Directions', mapsDirections(origin, venue.name, venue.address)),
        link('Add to plan', `/plan.html?food=${encodeURIComponent(food.id)}&venue=${encodeURIComponent(venue.id)}`)
      );
      row.append(
        el('strong', '', venue.name),
        el('span', '', venue.address),
        el('span', 'venue-row__distance', `~${approxKm(origin, venue).toFixed(1)} km straight-line from ${origin.name}`),
        actions
      );
      venues.append(row);
    }
    copy.append(venues);
    card.append(copy);
    return card;
  }));
}

originSelect.addEventListener('change', () => {
  const trip = readTrip();
  trip.originId = originSelect.value;
  saveTrip(trip);
  renderFood();
});
search.addEventListener('input', renderFood);

try {
  foods = (await loadSpots()).filter((spot) => spot.kind === 'food');
  renderFood();
  if (location.hash && document.getElementById(location.hash.slice(1))) {
    document.getElementById(location.hash.slice(1)).scrollIntoView();
  }
} catch (error) {
  count.textContent = error.message;
}
