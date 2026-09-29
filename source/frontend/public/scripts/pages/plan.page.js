/**
 * Lịch 1-3 ngày lưu trong localStorage. Khách chọn điểm, trang tự đặt giờ
 * theo buổi. Khoảng cách và giờ di chuyển chỉ là gợi ý; Maps chỉ đường thật.
 */
import {
  ORIGINS, TOURS, approxKm, dateForDay, loadSpots, mapsDirections,
  originFor, readFavorites, readTrip, saveTrip, sortedVenues, spotPoint,
} from '../shared/guide.js';
import { el, link, picture } from '../shared/ui.js';

const SLOT_ORDER = ['morning', 'afternoon', 'evening'];
const SLOT_START = { morning: 8 * 60, afternoon: 12 * 60, evening: 18 * 60 };
const SLOT_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
const trip = readTrip();
let activeDay = 0;
let spots = [];
let byId = new Map();

const ui = Object.fromEntries([
  'start-date', 'day-count', 'trip-origin', 'day-tabs', 'day-title', 'day-origin',
  'tour-list', 'food-choice', 'venue-choice', 'food-slot', 'place-choice',
  'place-slot', 'timeline', 'plan-status',
].map((id) => [id, document.getElementById(id)]));

const message = (text) => { ui['plan-status'].textContent = text; };
const currentOrigin = () => originFor(trip, activeDay);
const currentStops = () => trip.days[activeDay].stops;
const save = () => saveTrip(trip);

function addOptions(select, data, label, selected) {
  select.replaceChildren(...data.map((item) => {
    const option = el('option', '', label(item));
    option.value = item.id;
    if (item.id === selected) option.selected = true;
    return option;
  }));
}

function renderOrigins() {
  addOptions(ui['trip-origin'], ORIGINS, (item) => item.name, trip.originId);
  const shared = el('option', '', 'Use trip starting point');
  shared.value = '';
  const options = ORIGINS.map((origin) => {
    const option = el('option', '', origin.name);
    option.value = origin.id;
    return option;
  });
  ui['day-origin'].replaceChildren(shared, ...options);
  ui['day-origin'].value = trip.days[activeDay].originId ?? '';
}

function renderTabs() {
  ui['day-tabs'].replaceChildren(...Array.from({ length: trip.dayCount }, (_, index) => {
    const button = el('button', index === activeDay ? 'day-tab day-tab--active' : 'day-tab', `Day ${index + 1} · ${dateForDay(trip.startDate, index)}`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(index === activeDay));
    button.addEventListener('click', () => { activeDay = index; render(); });
    return button;
  }));
}

function renderVenues(selectedId) {
  const food = byId.get(ui['food-choice'].value);
  const venues = food ? sortedVenues(food, currentOrigin()) : [];
  addOptions(ui['venue-choice'], venues, (venue) => `${venue.name} · ${venue.address}`, selectedId);
}

function chooseVendor(stop, origin) {
  const food = byId.get(stop.spotId);
  return food?.venues?.find((item) => item.id === stop.venueId) ?? sortedVenues(food ?? {}, origin)[0];
}

function formatTime(minutes) {
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function openingWarning(spot, dateText, start, finish) {
  const hours = spot.openingHours ?? '';
  const weekday = new Date(`${dateText}T12:00:00`).getDay();
  if (/closed Monday/i.test(hours) && weekday === 1) return 'May be closed on Monday. Check before visiting.';
  if (/closed Friday afternoon/i.test(hours) && weekday === 5 && start >= 12 * 60) return 'May be closed on Friday afternoon.';
  const ranges = [...hours.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)];
  if (!ranges.length || /open all day/i.test(hours)) return '';
  const fits = ranges.some(([, h1, m1, h2, m2]) => {
    return start >= Number(h1) * 60 + Number(m1) && finish <= Number(h2) * 60 + Number(m2);
  });
  return fits ? '' : `Outside listed hours (${hours}). Check before visiting.`;
}

function renderTimeline() {
  const origin = currentOrigin();
  const stops = currentStops().map((stop, index) => ({ ...stop, originalIndex: index }))
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || a.originalIndex - b.originalIndex);
  if (!stops.length) {
    ui.timeline.replaceChildren(el('p', 'plan-empty', 'Choose a tour or add a dish and a place to start this day.'));
    return;
  }

  let cursor = 0;
  let previous = origin;
  const date = new Date(`${trip.startDate}T12:00:00`);
  date.setDate(date.getDate() + activeDay);
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const rows = stops.map((stop) => {
    const spot = byId.get(stop.spotId);
    if (!spot) return null;
    const venue = stop.kind === 'food' ? chooseVendor(stop, origin) : null;
    const point = spotPoint(spot, venue);
    const travelBuffer = previous.district === point.district ? 15 : 30;
    const start = Math.max(SLOT_START[stop.slot], cursor + (cursor ? travelBuffer : 0));
    const duration = spot.kind === 'food' ? 50 : (spot.durationMinutes ?? 60);
    const end = start + duration;
    cursor = end;

    const item = el('li', 'timeline-stop');
    const time = el('time', 'timeline-stop__time', formatTime(start));
    time.dateTime = `${localDate}T${formatTime(start)}`;
    const body = el('div', 'timeline-stop__body');
    body.append(el('p', 'eyebrow', SLOT_LABEL[stop.slot]), el('h3', '', spot.name));
    const name = venue?.name ?? spot.name;
    const address = venue?.address ?? spot.address;
    body.append(el('p', '', `${name} · ${address}`));
    body.append(el('p', 'timeline-stop__details', `${duration} min visit · ~${approxKm(previous, point).toFixed(1)} km straight-line from previous stop`));
    const warning = spot.kind === 'food'
      ? 'Check this restaurant’s opening hours on Maps before visiting.'
      : openingWarning(spot, localDate, start, end);
    if (warning) body.append(el('p', 'timeline-stop__warning', warning));

    const actions = el('div', 'timeline-stop__actions');
    actions.append(link('Walking directions', mapsDirections(previous, name, address)));
    if (venue) {
      const label = el('label', '', `Change restaurant for ${spot.name}`);
      const select = el('select', 'input');
      label.append(select);
      addOptions(select, sortedVenues(spot, origin), (item) => item.name, venue.id);
      select.addEventListener('change', () => {
        trip.days[activeDay].stops[stop.originalIndex].venueId = select.value;
        save(); renderTimeline();
      });
      actions.append(label);
    }
    const remove = el('button', 'text-action', 'Remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${spot.name} from day ${activeDay + 1}`);
    remove.addEventListener('click', () => {
      trip.days[activeDay].stops.splice(stop.originalIndex, 1);
      save(); renderTimeline(); message(`${spot.name} removed.`);
    });
    actions.append(remove);
    body.append(actions);
    item.append(time, body);
    previous = { ...point, name, address, district: venue?.district ?? spot.district };
    return item;
  }).filter(Boolean);
  const list = el('ol', 'timeline-list');
  list.append(...rows);
  ui.timeline.replaceChildren(list);
}

function useTour(tour) {
  const origin = currentOrigin();
  trip.days[activeDay].stops = tour.stops.map((stop) => ({
    ...stop,
    venueId: stop.kind === 'food' ? sortedVenues(byId.get(stop.spotId), origin)[0]?.id : undefined,
  }));
  save();
  renderTimeline();
  message(`${tour.title} added to day ${activeDay + 1}.`);
}

function renderTours() {
  ui['tour-list'].replaceChildren(...TOURS.map((tour) => {
    const card = el('article', 'tour-card');
    card.append(picture(tour.image, tour.title));
    const body = el('div', 'tour-card__body');
    body.append(el('h3', '', tour.title), el('p', '', tour.description));
    const button = el('button', 'button button--secondary', `Use for day ${activeDay + 1}`);
    button.type = 'button';
    button.addEventListener('click', () => {
      if (currentStops().length && !window.confirm(`Replace the stops in day ${activeDay + 1}?`)) return;
      useTour(tour);
    });
    body.append(button);
    card.append(body);
    return card;
  }));
}

function render() {
  ui['day-title'].textContent = `Day ${activeDay + 1}: ${dateForDay(trip.startDate, activeDay)}`;
  ui['start-date'].value = trip.startDate;
  ui['day-count'].value = String(trip.dayCount);
  renderOrigins(); renderTabs(); renderVenues(); renderTours(); renderTimeline();
}

ui['start-date'].addEventListener('change', () => { trip.startDate = ui['start-date'].value; save(); render(); });
ui['day-count'].addEventListener('change', () => { trip.dayCount = Number(ui['day-count'].value); activeDay = Math.min(activeDay, trip.dayCount - 1); save(); render(); });
ui['trip-origin'].addEventListener('change', () => { trip.originId = ui['trip-origin'].value; save(); render(); });
ui['day-origin'].addEventListener('change', () => { trip.days[activeDay].originId = ui['day-origin'].value || null; save(); render(); });
ui['food-choice'].addEventListener('change', () => renderVenues());

document.querySelector('#add-food').addEventListener('submit', (event) => {
  event.preventDefault();
  const food = byId.get(ui['food-choice'].value);
  if (!food) return;
  if (currentStops().length >= 6) return message('Keep each day to six stops so the schedule stays readable.');
  if (currentStops().some((stop) => stop.spotId === food.id)) return message(`${food.name} is already in this day.`);
  currentStops().push({ kind: 'food', spotId: food.id, venueId: ui['venue-choice'].value, slot: ui['food-slot'].value });
  save(); renderTimeline(); message(`${food.name} added to day ${activeDay + 1}.`);
});
document.querySelector('#add-place').addEventListener('submit', (event) => {
  event.preventDefault();
  const place = byId.get(ui['place-choice'].value);
  if (!place) return;
  if (currentStops().length >= 6) return message('Keep each day to six stops so the schedule stays readable.');
  if (currentStops().some((stop) => stop.spotId === place.id)) return message(`${place.name} is already in this day.`);
  currentStops().push({ kind: 'place', spotId: place.id, slot: ui['place-slot'].value });
  save(); renderTimeline(); message(`${place.name} added to day ${activeDay + 1}.`);
});

try {
  spots = await loadSpots();
  byId = new Map(spots.map((spot) => [spot.id, spot]));
  const saved = new Set(readFavorites());
  addOptions(ui['food-choice'], spots.filter((spot) => spot.kind === 'food'),
    (spot) => saved.has(spot.id) ? `♥ ${spot.name}` : spot.name);
  addOptions(ui['place-choice'], spots.filter((spot) => spot.kind === 'place'), (spot) => spot.name);
  const params = new URLSearchParams(location.search);
  if (byId.get(params.get('food'))?.kind === 'food') ui['food-choice'].value = params.get('food');
  if (byId.get(params.get('place'))?.kind === 'place') ui['place-choice'].value = params.get('place');
  render();
  if (params.get('venue')) renderVenues(params.get('venue'));
  if (params.get('tour')) {
    const selected = TOURS.find((tour) => tour.id === params.get('tour'));
    if (selected && !currentStops().length) useTour(selected);
    else if (selected) message(`Day 1 already has stops. Use the ${selected.title} button to replace them.`);
  }
} catch (error) {
  message(error.message);
}
