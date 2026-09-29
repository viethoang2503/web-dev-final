/**
 * Lịch 1-3 ngày lưu trong localStorage. Khách chọn điểm, trang tự đặt giờ
 * theo buổi. Khoảng cách và giờ di chuyển chỉ là gợi ý; Maps chỉ đường thật.
 */
import {
  MAX_DAYS, ORIGINS, TOURS, addDays, dateForDay, daysBetween, ensureDays, dayUsingSpot, loadSpots, mapsDirections, mapsRoute,
  normalizeTrip, originFor, pruneTrip, readFavorites, readTrip, saveTrip, sortedVenues, spotPoint,
} from '../shared/guide.js';
import { buildIcs } from '../shared/calendar.js';
import { shareUrl, sharedTripFromHash } from '../shared/share.js';
import {
  addCustomTour, deleteCustomTour, deletePlan, readCustomTours, readSavedPlans, savePlan,
} from '../shared/library.js';
import { MAX_DURATION, MAX_STOPS_PER_DAY, MIN_DURATION, SLOT_LABEL, formatTime, insertStopByTime, moveStop, optimizeOrder, orderStops, scheduleDay, slotForTime, suggestNearby } from '../shared/schedule.js';
import { buildTourStops } from '../shared/tours.js';
import { el, link, picture } from '../shared/ui.js';

const trip = readTrip();
let activeDay = 0;
let spots = [];
let byId = new Map();
const openAdjust = new Set(); // spotId của các ô "Adjust time" đang mở, giữ qua lần render lại
let pendingFocus = null;
let highlightId = null; // spotId của điểm vừa thêm, để cuộn tới và tô sáng

const ui = Object.fromEntries([
  'start-date', 'end-date', 'day-count', 'tour-note', 'plan-all', 'trip-origin', 'day-tabs', 'day-title', 'day-origin',
  'tour-list', 'food-choice', 'venue-choice', 'food-slot', 'place-choice',
  'place-slot', 'timeline', 'plan-status', 'day-summary', 'day-panel', 'route-link', 'copy-share', 'print-plan', 'download-ics',
  'share-fallback', 'share-url', 'print-view', 'optimise-order', 'nearby', 'saved-plans', 'plan-name', 'tour-name', 'more-menu', 'open-library', 'plan-library', 'nearby-title', 'custom-name', 'custom-address', 'custom-time', 'custom-length', 'custom-slot',
].map((id) => [id, document.getElementById(id)]));

/** Thông báo ngắn; `undo` (nếu có) hiện thành nút hoàn tác thay cho hộp confirm. */
function message(text, undo) {
  const parts = [el('span', '', text)];
  if (undo) {
    const button = el('button', 'text-action', 'Undo');
    button.type = 'button';
    button.addEventListener('click', () => { undo(); save(); render(); message('Change undone.'); });
    parts.push(button);
  }
  ui['plan-status'].replaceChildren(...parts);
}

/** Trả về hàm khôi phục danh sách điểm dừng của ngày `day` như lúc gọi. */
function snapshotDay(day) {
  const stops = trip.days[day].stops.map((stop) => ({ ...stop }));
  return () => { trip.days[day].stops = stops; activeDay = day; };
}
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
  const tabs = Array.from({ length: trip.dayCount }, (_, index) => {
    const active = index === activeDay;
    const button = el('button', active ? 'day-tab day-tab--active' : 'day-tab', `Day ${index + 1} · ${dateForDay(trip.startDate, index)}`);
    button.type = 'button';
    button.id = `day-tab-${index}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(active));
    button.setAttribute('aria-controls', 'day-panel');
    button.tabIndex = active ? 0 : -1;
    button.addEventListener('click', () => { activeDay = index; render(); });
    button.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? trip.dayCount - 1
        : step ? (index + step + trip.dayCount) % trip.dayCount : null;
      if (target === null) return;
      event.preventDefault();
      activeDay = target; render();
      document.getElementById(`day-tab-${target}`).focus();
    });
    return button;
  });
  ui['day-tabs'].replaceChildren(...tabs);
  ui['day-panel'].setAttribute('aria-labelledby', `day-tab-${activeDay}`);
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

function localDateFor(index) {
  const date = new Date(`${trip.startDate}T12:00:00`);
  date.setDate(date.getDate() + index);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function renderSummary(summary, items = []) {
  if (!summary.stopCount) { ui['day-summary'].replaceChildren(); return; }
  const rows = [
    ['Schedule', `${formatTime(summary.startMinutes)} – ${formatTime(summary.endMinutes)}`],
    ['Stops', String(summary.stopCount)],
    ['Travel', `~${summary.totalKm.toFixed(1)} km straight-line · ~${summary.travelMinutes} min`],
    ['Entry fees', summary.admissionTotal ? `${summary.admissionTotal.toLocaleString('en-US')} VND` : 'Free'],
  ];
  const list = el('dl', 'day-summary__list');
  list.replaceChildren(...rows.map(([label, value]) => {
    const row = el('div', 'day-summary__row');
    row.append(el('dt', '', label), el('dd', '', value));
    return row;
  }));
  const box = el('section', 'day-summary');
  box.setAttribute('aria-label', `Summary of day ${activeDay + 1}`);
  box.append(list);
  const issues = items.flatMap((item) => item.warnings.map((warning) => `${item.spot.name}: ${warning}`));
  if (issues.length) {
    const warnings = el('ul', 'day-summary__warnings');
    warnings.append(...issues.slice(0, 3).map((text) => el('li', 'timeline-stop__warning', text)));
    if (issues.length > 3) warnings.append(el('li', 'day-summary__more', `and ${issues.length - 3} more below`));
    box.append(warnings);
  }
  ui['day-summary'].replaceChildren(box);
}

function moveButtons(entry, position, total) {
  return [['up', -1, '↑ Move up', position === 0], ['down', 1, '↓ Move down', position === total - 1]].map(([key, direction, label, disabled]) => {
    const button = el('button', 'text-action', label);
    button.type = 'button';
    button.disabled = disabled;
    button.dataset.move = `${entry.spot.id}:${key}`;
    button.setAttribute('aria-label', `${label.slice(2)}: ${entry.spot.name}`);
    button.addEventListener('click', () => {
      trip.days[activeDay].stops = moveStop(currentStops(), entry.originalIndex, direction);
      pendingFocus = `${entry.spot.id}:${key}`;
      save(); renderTimeline();
    });
    return button;
  });
}

const toMinutes = (text) => {
  const [hour, minute] = text.split(':').map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute) ? hour * 60 + minute : null;
};

/** Ô nhỏ cho phép ghim giờ bắt đầu và đổi thời gian ở lại của một điểm. */
function adjustPanel(entry, position, total) {
  const details = el('details', 'timeline-stop__adjust');
  details.open = openAdjust.has(entry.spot.id);
  details.addEventListener('toggle', () => {
    details.open ? openAdjust.add(entry.spot.id) : openAdjust.delete(entry.spot.id);
  });
  details.append(el('summary', '', 'Edit stop'));

  const stop = () => trip.days[activeDay].stops[entry.originalIndex];
  const startLabel = el('label', '', 'Start time');
  const start = el('input', 'input');
  start.type = 'time';
  start.value = formatTime(entry.start);
  startLabel.append(start);
  start.addEventListener('change', () => {
    const minutes = toMinutes(start.value);
    if (minutes === null) delete stop().startTime; else stop().startTime = minutes;
    save(); renderTimeline();
  });

  const lengthLabel = el('label', '', 'Time here (minutes)');
  const length = el('input', 'input');
  length.type = 'number';
  length.min = String(MIN_DURATION);
  length.max = String(MAX_DURATION);
  length.step = '5';
  length.value = String(entry.duration);
  lengthLabel.append(length);
  length.addEventListener('change', () => {
    const minutes = Math.round(Number(length.value));
    if (Number.isFinite(minutes) && minutes >= MIN_DURATION && minutes <= MAX_DURATION) stop().duration = minutes;
    else message(`Time here must be between ${MIN_DURATION} and ${MAX_DURATION} minutes.`);
    save(); renderTimeline();
  });

  const reset = el('button', 'text-action', 'Reset to automatic');
  reset.type = 'button';
  reset.disabled = !entry.pinned && !entry.customDuration;
  reset.addEventListener('click', () => {
    delete stop().startTime; delete stop().duration;
    save(); renderTimeline();
  });
  const order = el('div', 'timeline-stop__order');
  order.append(...moveButtons(entry, position, total));
  details.append(order);
  if (entry.venue) {
    const label = el('label', 'timeline-stop__wide', 'Restaurant');
    const select = el('select', 'input');
    label.append(select);
    addOptions(select, sortedVenues(entry.spot, currentOrigin()), (option) => option.name, entry.venue.id);
    select.addEventListener('change', () => {
      stop().venueId = select.value;
      save(); renderTimeline();
    });
    details.append(label);
  }
  details.append(startLabel, lengthLabel, reset);
  return details;
}

function scheduleFor(index) {
  const origin = originFor(trip, index);
  const dateText = localDateFor(index);
  const result = scheduleDay({
    stops: trip.days[index].stops,
    origin,
    dateText,
    getSpot: (id) => byId.get(id),
    getVenue: (stop) => chooseVendor(stop, origin),
    getPoint: spotPoint,
  });
  return { ...result, origin, dateText };
}

/** Các ngày đang hiển thị (theo số ngày của chuyến đi) có ít nhất một điểm dừng. */
const plannedDays = () => Array.from({ length: trip.dayCount }, (_, index) => ({ index, ...scheduleFor(index) }))
  .filter((day) => day.items.length);

function renderRouteLink(items, origin) {
  const link = ui['route-link'];
  link.hidden = !items.length;
  if (items.length) link.href = mapsRoute(origin, items);
}

/** Bản in: mọi ngày trong một danh sách tĩnh, chỉ hiện khi in (xem guide.css). */
function renderPrintView() {
  const days = plannedDays();
  const sections = days.map((day) => {
    const section = el('section', 'print-day');
    section.append(el('h2', '', `Day ${day.index + 1}: ${dateForDay(trip.startDate, day.index)}`));
    section.append(el('p', 'print-day__meta', `Start from ${day.origin.name} · ${formatTime(day.summary.startMinutes)} – ${formatTime(day.summary.endMinutes)} · ~${day.summary.totalKm.toFixed(1)} km straight-line`));
    const list = el('ol', 'print-day__list');
    list.append(...day.items.map((entry) => {
      const row = el('li', '');
      row.append(el('strong', '', `${formatTime(entry.start)} ${entry.spot.name}`));
      row.append(el('span', '', `${[entry.name, entry.address].filter(Boolean).join(', ')} (${entry.duration} min)`));
      for (const warning of entry.warnings) row.append(el('em', '', warning));
      return row;
    }));
    section.append(list);
    return section;
  });
  ui['print-view'].replaceChildren(el('h1', '', 'Hanoi Local plan'), ...(sections.length ? sections : [el('p', '', 'No stops planned yet.')]),
    el('p', 'print-day__meta', 'Times and distances are estimates. Check opening hours and directions on Google Maps.'));
}

const SLOT_TEXT = { morning: 'morning', afternoon: 'afternoon', evening: 'evening' };

/** Gợi ý gần điểm cuối của ngày; bấm nút để thêm vào đúng buổi đã tính. */
function renderNearby(items, origin, dateText) {
  const usedIds = new Set(currentStops().map((stop) => stop.spotId));
  const elsewhereIds = usedElsewhere(activeDay);
  const ideas = suggestNearby({ items, origin, spots, usedIds, elsewhereIds, dateText, getPoint: spotPoint });
  ui['nearby-title'].lastChild.textContent = items.length ? 'Ideas near your last stop' : `Ideas near ${origin.name}`;
  if (!ideas.length) {
    const full = currentStops().length >= MAX_STOPS_PER_DAY;
    ui.nearby.replaceChildren(el('p', 'plan-empty', full
      ? `This day already has ${MAX_STOPS_PER_DAY} stops. Remove one to see more ideas.`
      : 'Nothing else in the guide is open nearby at the time this day would reach it. Remove or move a stop, or add your own under "Something else".'));
    return;
  }
  const from = items.length ? 'the last stop' : origin.name;
  const list = el('ul', 'nearby-list');
  list.append(...ideas.map((idea) => {
    const row = el('li', 'nearby-item');
    const text = el('div', '');
    const other = idea.elsewhere ? dayUsingSpot(trip, idea.spot.id, activeDay) : -1;
    text.append(
      el('strong', '', idea.spot.name),
      el('p', '', `${idea.venue ? idea.venue.name : idea.spot.category} · ~${idea.km.toFixed(1)} km straight-line from ${from} · fits ${SLOT_TEXT[idea.slot]}, about ${formatTime(idea.start)}${other !== -1 ? ` · already in day ${other + 1}` : ''}`),
    );
    const add = el('button', 'button button--secondary', `Add to day ${activeDay + 1}`);
    add.type = 'button';
    add.setAttribute('aria-label', `Add ${idea.spot.name} to day ${activeDay + 1}`);
    add.addEventListener('click', () => addStop(idea.spot, {
      kind: idea.spot.kind, spotId: idea.spot.id, slot: idea.slot,
      ...(idea.venue ? { venueId: idea.venue.id } : {}),
    }));
    row.append(text, add);
    return row;
  }));
  ui.nearby.replaceChildren(list);
}

function optimiseDay() {
  const stops = currentStops();
  if (stops.length < 2) return message('Add at least two stops to optimise the order.');
  const origin = currentOrigin();
  const before = scheduleFor(activeDay).summary.totalKm;
  const next = optimizeOrder(stops, {
    origin, getSpot: (id) => byId.get(id), getVenue: (stop) => chooseVendor(stop, origin), getPoint: spotPoint,
  });
  const current = orderStops(stops).map((entry) => entry.stop.spotId);
  if (next.every((stop, index) => stop.spotId === current[index])) return message('This order is already the closest one I can find.');
  const restore = snapshotDay(activeDay);
  trip.days[activeDay].stops = next;
  const after = scheduleFor(activeDay).summary.totalKm;
  if (after >= before - 0.05) {
    restore();
    return message('Reordering would not shorten the route, so nothing changed.');
  }
  save(); renderTimeline();
  message(`Order optimised inside each part of the day: ~${before.toFixed(1)} km to ~${after.toFixed(1)} km straight-line.`, restore);
}

function renderTimeline() {
  const { items, summary, origin, dateText: localDate } = scheduleFor(activeDay);
  renderSummary(summary, items);
  renderRouteLink(items, origin);
  renderPrintView();
  renderNearby(items, origin, localDate);
  if (!items.length) {
    ui.timeline.replaceChildren(el('p', 'plan-empty', 'Nothing planned for this day yet. Start with a tour, or add your own stop.'));
    return;
  }

  let scrollTarget = null;
  const rows = items.map((entry, position) => {
    const { spot, venue, name, address, previous } = entry;
    const item = el('li', highlightId === spot.id ? 'timeline-stop timeline-stop--new' : 'timeline-stop');
    item.dataset.stop = spot.id;
    if (highlightId === spot.id) scrollTarget = item;
    const time = el('time', 'timeline-stop__time', formatTime(entry.start));
    time.dateTime = `${localDate}T${formatTime(entry.start)}`;
    const body = el('div', 'timeline-stop__body');
    body.append(el('p', 'eyebrow', SLOT_LABEL[entry.stop.slot]), el('h3', '', spot.name));
    body.append(el('p', '', entry.noCoords ? (address || 'Your own stop') : `${name} · ${address}`));
    const custom = entry.pinned || entry.customDuration ? ' · custom time' : '';
    const travel = entry.travelMinutes ? ` · ~${entry.travelMinutes} min travel` : '';
    const detail = entry.noCoords
      ? `${entry.duration} min, until ${formatTime(entry.end)}${travel ? ` · about ${entry.travelMinutes} min to get here` : ''}${custom}`
      : `${entry.duration} min visit, until ${formatTime(entry.end)} · ~${entry.km.toFixed(1)} km straight-line from previous stop${travel}${custom}`;
    body.append(el('p', 'timeline-stop__details', detail));
    for (const warning of entry.warnings) body.append(el('p', 'timeline-stop__warning', warning));
    if (spot.kind === 'food' && !entry.warnings.length) {
      body.append(el('p', 'timeline-stop__details', 'Restaurant hours vary. Check them on Maps before visiting.'));
    }

    const actions = el('div', 'timeline-stop__actions');
    actions.append(link('Walking directions', mapsDirections(previous, name, address)));
    actions.append(adjustPanel(entry, position, items.length));
    const remove = el('button', 'text-action', 'Remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${spot.name} from day ${activeDay + 1}`);
    remove.addEventListener('click', () => {
      const restore = snapshotDay(activeDay);
      trip.days[activeDay].stops.splice(entry.originalIndex, 1);
      save(); renderTimeline(); message(`${spot.name} removed.`, restore);
    });
    actions.append(remove);
    body.append(actions);
    item.append(time, body);
    return item;
  });
  const list = el('ol', 'timeline-list');
  list.append(...rows);
  ui.timeline.replaceChildren(list);
  if (scrollTarget) scrollTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  highlightId = null;
  if (pendingFocus) {
    const [spotId, key] = pendingFocus.split(':');
    const target = [...ui.timeline.querySelectorAll('[data-move]')].find((button) => button.dataset.move === pendingFocus && !button.disabled)
      ?? ui.timeline.querySelector(`[data-move="${spotId}:${key === 'up' ? 'down' : 'up'}"]:not(:disabled)`);
    target?.focus();
    pendingFocus = null;
  }
}

/** Điểm đã nằm ở các ngày khác của chuyến đi (không tính ngày `day`), để tour mỗi ngày một khác. */
function usedElsewhere(day) {
  return new Set(trip.days.slice(0, trip.dayCount).flatMap((item, index) => (index === day ? [] : item.stops.map((stop) => stop.spotId))));
}

/** Điểm dừng của một tour cho ngày `day`. Tour mẫu dựng theo mốc xuất phát; tour tự tạo giữ nguyên điểm đã lưu. */
function stopsForTour(tour, day) {
  const origin = originFor(trip, day);
  if (tour.custom) {
    return tour.stops.filter((stop) => stop.kind === 'custom' || byId.has(stop.spotId)).map((stop) => ({
      ...stop,
      ...(stop.kind === 'food' ? { venueId: sortedVenues(byId.get(stop.spotId), origin)[0]?.id } : {}),
    }));
  }
  return buildTourStops(tour, { origin, spots, usedIds: usedElsewhere(day), getPoint: spotPoint });
}

function useTour(tour) {
  const hadStops = currentStops().length > 0;
  const restore = snapshotDay(activeDay);
  const stops = stopsForTour(tour, activeDay);
  if (!stops.length) return message('No spots left for this tour. Remove a stop from another day, or pick a different tour.');
  trip.days[activeDay].stops = stops;
  save();
  renderTimeline();
  message(`${tour.title} ${hadStops ? 'replaced the stops in' : 'added to'} day ${activeDay + 1}.`, hadStops ? restore : undefined);
}

/** Điền mọi ngày còn trống bằng các tour khác nhau, xoay vòng theo ngày và không lặp điểm khi còn điểm mới. */
function planEmptyDays() {
  const before = trip.days.map((day) => day.stops.map((stop) => ({ ...stop })));
  const used = usedElsewhere(-1);
  let filled = 0;
  for (let index = 0; index < trip.dayCount; index += 1) {
    if (trip.days[index].stops.length) continue;
    const stops = buildTourStops(TOURS[index % TOURS.length], { origin: originFor(trip, index), spots, usedIds: used, getPoint: spotPoint });
    trip.days[index].stops = stops;
    for (const stop of stops) used.add(stop.spotId);
    if (stops.length) filled += 1;
  }
  if (!filled) return message('Every day already has stops.');
  save(); render();
  const undo = () => { before.forEach((stops, index) => { trip.days[index].stops = stops; }); };
  const reuse = trip.dayCount > 3 ? ' The guide has 20 spots, so later days may repeat favourites.' : '';
  message(`Filled ${filled} day${filled > 1 ? 's' : ''} with different tours.${reuse}`, undo);
}

function renderTours() {
  const custom = readCustomTours();
  const origin = currentOrigin();
  const usedIds = usedElsewhere(activeDay);
  ui['tour-note'].textContent = `Stops are chosen close to ${origin.name}${trip.dayCount > 1 ? ' and differ from your other days' : ''}. Change the start point to get different stops.`;
  ui['plan-all'].hidden = trip.dayCount < 2 || trip.days.slice(0, trip.dayCount).every((day) => day.stops.length);
  ui['tour-list'].replaceChildren(...[...TOURS, ...custom].map((tour) => {
    const card = el('article', tour.custom ? 'tour-card tour-card--custom' : 'tour-card');
    if (!tour.custom) card.append(picture(tour.image, tour.title));
    const body = el('div', 'tour-card__body');
    const stops = tour.custom ? tour.stops : buildTourStops(tour, { origin, spots, usedIds, getPoint: spotPoint });
    const names = stops.map((stop) => (stop.kind === 'custom' ? stop.name : byId.get(stop.spotId)?.name)).filter(Boolean);
    body.append(el('h3', '', tour.title), el('p', '', tour.custom ? `${tour.stops.length} stops · saved on this device` : tour.description));
    if (names.length) body.append(el('p', 'tour-card__stops', names.join(' → ')));
    const button = el('button', 'button button--secondary', 'Use this tour');
    button.type = 'button';
    button.setAttribute('aria-label', `Use ${tour.title} for day ${activeDay + 1}`);
    button.addEventListener('click', () => useTour(tour));
    body.append(button);
    if (tour.custom) {
      const remove = el('button', 'text-action', 'Delete tour');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Delete tour ${tour.title}`);
      remove.addEventListener('click', () => { deleteCustomTour(tour.id); renderTours(); message(`Tour "${tour.title}" deleted.`); });
      body.append(remove);
    }
    card.append(body);
    return card;
  }));
}

/** Thay toàn bộ lịch hiện tại bằng `next`; trả về thông báo kèm hàm hoàn tác nếu lịch cũ có nội dung. */
function replaceTrip(next, text) {
  const previous = structuredClone(trip);
  const hadPlan = previous.days.some((day) => day.stops.length);
  Object.assign(trip, structuredClone(next));
  activeDay = 0;
  save();
  return { text, undo: hadPlan ? () => { Object.assign(trip, previous); activeDay = 0; } : undefined };
}

function renderSavedPlans() {
  const plans = readSavedPlans();
  if (!plans.length) {
    ui['saved-plans'].replaceChildren(el('li', 'plan-empty', 'No saved plans yet. Save the current plan to keep it and start another.'));
    return;
  }
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  ui['saved-plans'].replaceChildren(...plans.map((plan) => {
    const stopCount = plan.trip.days.slice(0, plan.trip.dayCount).reduce((sum, day) => sum + day.stops.length, 0);
    const row = el('li', 'plan-library__item');
    const text = el('div', '');
    text.append(el('strong', '', plan.name), el('p', '', `${plan.trip.dayCount} day${plan.trip.dayCount > 1 ? 's' : ''} · ${stopCount} stops · saved ${date.format(plan.savedAt)}`));
    const load = el('button', 'button button--secondary', 'Open');
    load.type = 'button';
    load.setAttribute('aria-label', `Open saved plan ${plan.name}`);
    load.addEventListener('click', () => {
      const notice = replaceTrip(plan.trip, `"${plan.name}" opened in place of your current plan. Save the current plan first if you want to keep it.`);
      render(); message(notice.text, notice.undo);
    });
    const remove = el('button', 'text-action', 'Delete');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Delete saved plan ${plan.name}`);
    remove.addEventListener('click', () => { deletePlan(plan.id); renderSavedPlans(); message(`"${plan.name}" deleted.`); });
    row.append(text, load, remove);
    return row;
  }));
}

function renderDates() {
  ui['start-date'].value = trip.startDate;
  ui['end-date'].value = addDays(trip.startDate, trip.dayCount - 1);
  ui['end-date'].min = trip.startDate;
  ui['end-date'].max = addDays(trip.startDate, MAX_DAYS - 1);
  ui['day-count'].value = String(trip.dayCount);
}

function render() {
  renderDates();
  ui['day-title'].textContent = `Day ${activeDay + 1}: ${dateForDay(trip.startDate, activeDay)}`;
  renderOrigins(); renderTabs(); renderVenues(); renderTours(); renderSavedPlans(); renderTimeline();
}

ui['start-date'].addEventListener('change', () => { if (ui['start-date'].value) trip.startDate = ui['start-date'].value; save(); render(); });
/** Đổi số ngày (từ ô số hoặc ngày kết thúc); giữ dữ liệu các ngày bị ẩn để bật lại khi tăng số ngày. */
function setDayCount(days) {
  if (!Number.isInteger(days) || days < 1) { render(); return message('The trip needs at least one day, and the ending date cannot be before the starting date.'); }
  const count = Math.min(days, MAX_DAYS);
  trip.dayCount = count;
  ensureDays(trip, count);
  activeDay = Math.min(activeDay, count - 1);
  save(); render();
  if (days > MAX_DAYS) message(`A trip can have up to ${MAX_DAYS} days, so the ending date was set to day ${MAX_DAYS}.`);
}

ui['day-count'].addEventListener('change', () => setDayCount(Math.round(Number(ui['day-count'].value))));
ui['end-date'].addEventListener('change', () => {
  const value = ui['end-date'].value;
  if (!value) return render();
  setDayCount(daysBetween(trip.startDate, value) + 1);
});
function originChanged() {
  save(); render();
  if (currentStops().length) message(`Start point changed to ${currentOrigin().name}. Pick a tour again to rebuild this day around it.`);
}
ui['day-origin'].addEventListener('change', () => { trip.days[activeDay].originId = ui['day-origin'].value || null; originChanged(); });
ui['trip-origin'].addEventListener('change', () => { trip.originId = ui['trip-origin'].value; originChanged(); });
ui['plan-all'].addEventListener('click', planEmptyDays);
ui['food-choice'].addEventListener('change', () => renderVenues());

/**
 * Thêm một điểm dừng vào ngày đang xem. `spot` là món/địa điểm trong catalogue, hoặc null với điểm tự nhập.
 * Điểm có giờ cụ thể được chèn đúng vị trí theo giờ. Trả về true nếu đã thêm.
 */
function addStop(spot, stop) {
  const label = spot?.name ?? stop.name;
  if (currentStops().length >= MAX_STOPS_PER_DAY) {
    message(`This day already has ${MAX_STOPS_PER_DAY} stops. Remove one first, or use another day.`);
    return false;
  }
  if (spot && currentStops().some((item) => item.spotId === spot.id)) {
    message(`${label} is already in this day.`);
    return false;
  }
  const other = spot ? dayUsingSpot(trip, spot.id, activeDay) : -1;
  if (Number.isInteger(stop.startTime)) {
    trip.days[activeDay].stops = insertStopByTime(currentStops(), stop, scheduleFor(activeDay).items);
  } else {
    currentStops().push(stop);
  }
  highlightId = stop.spotId;
  save(); renderTimeline();
  const entry = scheduleFor(activeDay).items.find((item) => item.stop.spotId === stop.spotId);
  const when = entry ? ` at ${formatTime(entry.start)}` : '';
  const also = other !== -1 ? ` It is also in day ${other + 1}.` : '';
  message(`${label} added to day ${activeDay + 1}${when}.${also}`);
  return true;
}

document.querySelector('#add-food').addEventListener('submit', (event) => {
  event.preventDefault();
  const food = byId.get(ui['food-choice'].value);
  if (food) addStop(food, { kind: 'food', spotId: food.id, venueId: ui['venue-choice'].value, slot: ui['food-slot'].value });
});
document.querySelector('#add-place').addEventListener('submit', (event) => {
  event.preventDefault();
  const place = byId.get(ui['place-choice'].value);
  if (place) addStop(place, { kind: 'place', spotId: place.id, slot: ui['place-slot'].value });
});
document.querySelector('#add-custom').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = ui['custom-name'].value.trim();
  if (!name) return message('Type what you want to add, for example a dish or an activity.');
  const stop = {
    kind: 'custom',
    spotId: `custom-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`}`,
    name,
    address: ui['custom-address'].value.trim(),
    slot: ui['custom-slot'].value,
  };
  const time = ui['custom-time'].value;
  if (time) {
    const [hour, minute] = time.split(':').map(Number);
    stop.startTime = hour * 60 + minute;
    stop.slot = slotForTime(stop.startTime);
  }
  const lengthText = ui['custom-length'].value.trim();
  if (lengthText) {
    const minutes = Math.round(Number(lengthText));
    if (!Number.isFinite(minutes) || minutes < MIN_DURATION || minutes > MAX_DURATION) {
      return message(`Time there must be between ${MIN_DURATION} and ${MAX_DURATION} minutes.`);
    }
    if (minutes !== 60) stop.duration = minutes;
  }
  if (addStop(null, stop)) {
    ui['custom-name'].value = '';
    ui['custom-address'].value = '';
    ui['custom-time'].value = '';
    ui['custom-length'].value = '60';
    ui['custom-name'].focus({ preventScroll: true });
  }
});

async function copyShareLink() {
  const url = shareUrl(trip);
  ui['share-fallback'].hidden = true;
  try {
    await navigator.clipboard.writeText(url);
    message('Share link copied. Anyone who opens it gets a copy of this plan.');
  } catch {
    ui['share-url'].value = url;
    ui['share-fallback'].hidden = false;
    ui['share-url'].select();
    message('Could not copy automatically. Copy the link below.');
  }
}

function downloadCalendar() {
  const days = plannedDays();
  if (!days.length) return message('Add at least one stop before exporting.');
  const text = buildIcs(days.map(({ dateText, items }) => ({ dateText, items })), {
    mapsLink: (item) => mapsDirections(item.previous, item.name, item.address),
  });
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const anchor = el('a');
  anchor.href = url;
  anchor.download = 'hanoi-local-plan.ics';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  message('Calendar file downloaded. Times are Hanoi local times.');
}

ui['optimise-order'].addEventListener('click', optimiseDay);
document.querySelector('.more-menu__list').addEventListener('click', () => { ui['more-menu'].open = false; });
document.addEventListener('click', (event) => { if (!ui['more-menu'].contains(event.target)) ui['more-menu'].open = false; });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') ui['more-menu'].open = false; });
ui['open-library'].addEventListener('click', () => {
  ui['plan-library'].open = true;
  ui['plan-library'].scrollIntoView({ behavior: 'smooth', block: 'start' });
  ui['plan-name'].focus({ preventScroll: true });
});
document.querySelector('#save-plan').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!trip.days.slice(0, trip.dayCount).some((day) => day.stops.length)) return message('Add at least one stop before saving a plan.');
  const result = savePlan(ui['plan-name'].value, trip);
  if (result.error) return message(result.error);
  ui['plan-name'].value = '';
  renderSavedPlans();
  message(result.replaced ? 'Saved plan updated.' : 'Plan saved. Open it later from "My saved plans".');
});
document.querySelector('#new-plan').addEventListener('click', () => {
  const notice = replaceTrip(normalizeTrip(null), 'Started a new empty plan. Save the previous plan first if you want to keep it.');
  render(); message(notice.text, notice.undo);
});
document.querySelector('#save-tour').addEventListener('submit', (event) => {
  event.preventDefault();
  const stops = orderStops(currentStops()).map((entry) => entry.stop);
  const result = addCustomTour(ui['tour-name'].value, stops);
  if (result.error) return message(result.error);
  ui['tour-name'].value = '';
  renderTours();
  message(`Tour "${result.tours.at(-1).title}" saved. Use it on any day.`);
});
ui['copy-share'].addEventListener('click', copyShareLink);
ui['download-ics'].addEventListener('click', downloadCalendar);
ui['print-plan'].addEventListener('click', () => { renderPrintView(); window.print(); });

/** Áp dụng lịch từ link chia sẻ; nếu đang có lịch khác thì cho phép hoàn tác. */
function applySharedTrip() {
  const { present, trip: shared } = sharedTripFromHash();
  if (!present) return null;
  history.replaceState(null, '', location.pathname);
  if (!shared) return { text: 'That share link is not valid, so your saved plan was kept.' };
  const hadPlan = trip.days.some((day) => day.stops.length);
  return replaceTrip(shared, hadPlan ? 'Shared plan loaded in place of your previous plan.' : 'Shared plan loaded.');
}

try {
  spots = await loadSpots();
  byId = new Map(spots.map((spot) => [spot.id, spot]));
  const sharedNotice = applySharedTrip();
  const removed = pruneTrip(trip, new Set(byId.keys()));
  if (removed || sharedNotice) save();
  const saved = new Set(readFavorites());
  addOptions(ui['food-choice'], spots.filter((spot) => spot.kind === 'food'),
    (spot) => saved.has(spot.id) ? `♥ ${spot.name}` : spot.name);
  addOptions(ui['place-choice'], spots.filter((spot) => spot.kind === 'place'), (spot) => spot.name);
  const params = new URLSearchParams(location.search);
  if (byId.get(params.get('food'))?.kind === 'food') ui['food-choice'].value = params.get('food');
  if (byId.get(params.get('place'))?.kind === 'place') ui['place-choice'].value = params.get('place');
  render();
  if (sharedNotice) message(sharedNotice.text, sharedNotice.undo);
  else if (removed) message(`${removed} saved stop${removed > 1 ? 's' : ''} no longer in the guide ${removed > 1 ? 'were' : 'was'} removed from your plan.`);
  if (params.get('venue')) renderVenues(params.get('venue'));
  if (params.get('tour')) {
    const selected = TOURS.find((tour) => tour.id === params.get('tour'));
    if (selected && !currentStops().length) useTour(selected);
    else if (selected) message(`Day 1 already has stops. Use the ${selected.title} button to replace them.`);
  }
} catch (error) {
  message(error.message);
}
