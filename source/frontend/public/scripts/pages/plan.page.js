/**
 * TRUNG TÂM ĐIỀU KHIỂN TRANG PLAN. Có thể đọc theo thứ tự:
 * 1. trip và ui: dữ liệu đang sửa và các phần tử HTML tương ứng.
 * 2. Các hàm render: biến dữ liệu thành giao diện; scheduleFor gọi thuật toán trong schedule.js.
 * 3. Các sự kiện ở cuối file: nhận thao tác, sửa trip, save(), rồi render lại phần cần thiết.
 * 4. Khối try cuối file: tải API, đọc link đầu vào, dựng trang và bật các điều khiển.
 * trip.days chứa các ngày; stops chứa điểm dừng; activeDay bắt đầu từ 0 (Ngày 1).
 */
/**
 * Lịch nhiều ngày lưu trong localStorage. Khách chọn điểm, trang tự đặt giờ
 * theo buổi. Khoảng cách và giờ di chuyển chỉ là gợi ý; Maps chỉ đường thật.
 */
import {
  MAX_DAYS, ORIGINS, TOURS, addDays, dateForDay, daysBetween, ensureDays, dayUsingSpot, loadSpots, mapsDirections, mapsRoute,
  normalizeTrip, originFor, pruneTrip, readFavorites, readTrip, saveTrip, sortedVenues, spotPoint, approxKm,
} from '../shared/guide.js';
import { buildIcs } from '../shared/calendar.js';
import { shareUrl, sharedTripFromHash } from '../shared/share.js';
import {
  addCustomTour, deleteCustomTour, deletePlan, readCustomTours, readSavedPlans, savePlan,
} from '../shared/library.js';
import { MAX_DURATION, MAX_STOPS_PER_DAY, MIN_DURATION, SLOT_LABEL, formatTime, insertStopByTime, moveStop, optimizeOrder, orderStops, scheduleDay, slotForTime, suggestNearby } from '../shared/schedule.js';
import { buildTourStops } from '../shared/tours.js';
import { el, link, picture } from '../shared/ui.js';
import { createPicker, createConfirmation } from '../shared/plan-controls.js';

// TRẠNG THÁI TRANG: trip là nguồn dữ liệu chính; byId giúp tra món/địa điểm theo id nhanh hơn tìm mảng nhiều lần.
const trip = readTrip();
let activeDay = 0;
let spots = [];
let byId = new Map();
const openAdjust = new Set(); // spotId của các ô "Adjust time" đang mở, giữ qua lần render lại
let pendingFocus = null;
let highlightId = null; // Tô điểm vừa thêm; không tự cuộn làm mất vị trí nhập.
let storageWarning = '';

// ÁNH XẠ HTML: gom các phần tử theo id để các hàm bên dưới truy cập bằng ui[id].
const ui = Object.fromEntries([
  'start-date', 'end-date', 'day-count', 'trip-range', 'tour-note', 'plan-all', 'trip-origin', 'day-tabs', 'day-title', 'day-origin',
  'tour-list', 'food-choice', 'venue-choice', 'food-slot', 'place-choice',
  'place-slot', 'timeline', 'plan-status', 'day-summary', 'day-panel', 'route-link', 'copy-share', 'print-plan', 'download-ics',
  'share-fallback', 'share-url', 'print-view', 'optimise-order', 'nearby', 'saved-plans', 'plan-name', 'tour-name', 'more-menu', 'open-library', 'plan-library', 'nearby-title', 'custom-name', 'custom-address', 'custom-time', 'custom-length', 'custom-slot',
  'picker-target', 'day-origin-name', 'food-preview', 'place-preview', 'settings-error', 'storage-status',
].map((id) => [id, document.getElementById(id)]));
const selectPicker = createPicker(document.getElementById('picker-tabs'));
const confirmChange = createConfirmation(document.getElementById('confirm-change'));

/** Thông báo ngắn; `undo` giữ bản sao trước thao tác để người dùng hoàn tác. */
function message(text, undo) {
  const parts = [el('span', '', `${text}${storageWarning ? ` ${storageWarning}` : ''}`)];
  if (undo) {
    const button = el('button', 'text-action', 'Undo');
    button.type = 'button';
    button.addEventListener('click', () => { undo(); save(); render(); message('Change undone.'); });
    parts.push(button);
  }
  const dismiss = el('button', 'text-action', 'Dismiss');
  dismiss.type = 'button';
  dismiss.addEventListener('click', () => ui['plan-status'].replaceChildren());
  parts.push(dismiss);
  ui['plan-status'].replaceChildren(...parts);
}

/** Trả về hàm khôi phục danh sách điểm dừng của ngày `day` như lúc gọi. */
function snapshotDay(day) {
  const stops = trip.days[day].stops.map((stop) => ({ ...stop }));
  return () => {
    trip.dayCount = Math.max(trip.dayCount, day + 1);
    trip.days[day].stops = stops;
    activeDay = day;
  };
}
const currentOrigin = () => originFor(trip, activeDay);
const currentStops = () => trip.days[activeDay].stops;
/** Dữ liệu vẫn ở bộ nhớ nếu localStorage đầy/bị chặn; không báo lưu thành công giả. */
function save() {
  try {
    saveTrip(trip);
    storageWarning = '';
    ui['storage-status'].textContent = 'Saved in this browser. No account needed.';
  } catch {
    storageWarning = 'Could not save on this device. Keep this tab open and copy a share link from Tools.';
    ui['storage-status'].textContent = 'Not saved on this device.';
    message('');
  }
}

// Biến mảng dữ liệu thành các option của select và giữ lựa chọn hiện tại nếu vẫn có.
function addOptions(select, data, label, selected) {
  select.replaceChildren(...data.map((item) => {
    const option = el('option', '', label(item));
    option.value = item.id;
    if (item.id === selected) option.selected = true;
    return option;
  }));
}

// Dựng mốc xuất phát chung và riêng từng ngày; giá trị rỗng nghĩa là dùng mốc chung.
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

// Dựng tab từng ngày với số điểm; xử lý cả click và phím mũi tên/Home/End.
function renderTabs() {
  const tabs = Array.from({ length: trip.dayCount }, (_, index) => {
    const active = index === activeDay;
    const button = el('button', active ? 'day-tab day-tab--active' : 'day-tab');
    const count = trip.days[index].stops.length;
    button.append(el('strong', '', `Day ${index + 1}`), el('span', '', dateForDay(trip.startDate, index)),
      el('span', '', count ? `${count} stop${count > 1 ? 's' : ''}` : 'No stops yet'));
    button.type = 'button';
    button.id = `day-tab-${index}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(active));
    button.setAttribute('aria-controls', 'day-panel');
    button.tabIndex = active ? 0 : -1;
    button.addEventListener('click', () => {
      activeDay = index; render();
      document.getElementById(`day-tab-${index}`).focus({ preventScroll: true });
    });
    button.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
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

// Khi đổi món hoặc mốc, cập nhật danh sách quán theo khoảng cách và phần xem trước.
function renderVenues(selectedId = ui['venue-choice'].value) {
  const food = byId.get(ui['food-choice'].value);
  const venues = food ? sortedVenues(food, currentOrigin()) : [];
  addOptions(ui['venue-choice'], venues, (venue) => `${venue.name} (~${approxKm(currentOrigin(), venue).toFixed(1)} km)`, selectedId);
  renderPreview('food');
}

/** Ảnh, địa chỉ và Maps cạnh ô chọn để người dùng biết chính xác điểm sắp thêm. */
function renderPreview(kind) {
  const spot = byId.get(ui[`${kind}-choice`].value);
  const box = ui[`${kind}-preview`];
  if (!spot) { box.replaceChildren(); return; }
  const venue = kind === 'food' ? spot.venues?.find((item) => item.id === ui['venue-choice'].value) : null;
  const name = venue?.name ?? spot.name;
  const address = venue?.address ?? spot.address;
  const body = el('div');
  body.append(el('strong', '', name), el('p', '', address || 'Hanoi'));
  if (kind === 'food') body.append(el('p', '', 'Dish illustration; servings vary by restaurant.'));
  body.append(link('Check on Google Maps ↗', mapsDirections(currentOrigin(), name, address)));
  box.replaceChildren(...(spot.image ? [picture(spot.image, spot.name)] : []), body);
}

// Dùng quán đã lưu nếu còn tồn tại; nếu thiếu thì chọn quán gần mốc xuất phát nhất.
function chooseVendor(stop, origin) {
  const food = byId.get(stop.spotId);
  return food?.venues?.find((item) => item.id === stop.venueId) ?? sortedVenues(food ?? {}, origin)[0];
}

// Tính ngày cụ thể của tab để kiểm tra giờ mở cửa và xuất lịch.
function localDateFor(index) {
  const date = new Date(`${trip.startDate}T12:00:00`);
  date.setDate(date.getDate() + index);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Hiển thị giờ, số điểm, khoảng cách và vé; gom số cảnh báo từ từng điểm.
function renderSummary(summary, items = []) {
  if (!summary.stopCount) { ui['day-summary'].replaceChildren(); return; }
  const rows = [
    ['Schedule', `${formatTime(summary.startMinutes)} - ${formatTime(summary.endMinutes)}`],
    ['Stops', String(summary.stopCount)],
    ['Distance estimate', `~${summary.totalKm.toFixed(1)} km straight-line`],
    ['Entry fees (food excluded)', summary.admissionTotal ? `${summary.admissionTotal.toLocaleString('en-US')} VND` : 'No listed fees'],
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
    const warnings = el('p', 'day-summary__warnings', `${issues.length} timing or opening-hour notice${issues.length > 1 ? 's' : ''}. Check the highlighted stops below.`);
    box.append(warnings);
  }
  ui['day-summary'].replaceChildren(box);
}

// Nút lên/xuống lưu bản trước khi đổi thứ tự, tính lại giờ và hỗ trợ Undo.
function moveButtons(entry, position, total) {
  return [['up', -1, '↑ Move up', position === 0], ['down', 1, '↓ Move down', position === total - 1]].map(([key, direction, label, disabled]) => {
    const button = el('button', 'timeline-stop__move', key === 'up' ? '↑' : '↓');
    button.type = 'button';
    button.disabled = disabled;
    button.dataset.move = `${entry.spot.id}:${key}`;
    button.setAttribute('aria-label', `${label.slice(2)}: ${entry.spot.name}`);
    button.title = label.slice(2);
    button.addEventListener('click', () => {
      const restore = snapshotDay(activeDay);
      trip.days[activeDay].stops = moveStop(currentStops(), entry.originalIndex, direction);
      pendingFocus = `${entry.spot.id}:${key}`;
      save(); renderTimeline();
      message(`${entry.spot.name} moved ${key}. Automatic times updated.`, restore);
    });
    return button;
  });
}

// Đổi chuỗi HH:mm của input time sang số phút để thuật toán xử lý.
const toMinutes = (text) => {
  const [hour, minute] = text.split(':').map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute) ? hour * 60 + minute : null;
};

/** Ô nhỏ cho phép ghim giờ bắt đầu và đổi thời gian ở lại của một điểm. */
function adjustPanel(entry) {
  const details = el('details', 'timeline-stop__adjust');
  details.open = openAdjust.has(entry.spot.id);
  details.addEventListener('toggle', () => {
    details.open ? openAdjust.add(entry.spot.id) : openAdjust.delete(entry.spot.id);
  });
  details.append(el('summary', '', 'Details & edit'));
  // Mặc định chỉ hiện lịch tổng quan; thông tin phụ nằm trong phần mở rộng.
  const info = el('div', 'timeline-stop__info');
  info.append(
    el('p', '', entry.address || 'No address added'),
    el('p', '', `${entry.duration} min here · ${entry.pinned ? 'Time set by you' : 'Auto-scheduled'}`),
    el('p', '', entry.noCoords
      ? 'Distance unknown. Check travel time on Google Maps.'
      : `~${entry.km.toFixed(1)} km straight-line from ${entry.previous.name || 'previous stop'}${entry.travelMinutes ? ` (~${entry.travelMinutes} min travel buffer)` : ''}`)
  );
  details.append(info);

  const stop = () => trip.days[activeDay].stops[entry.originalIndex];
  const startLabel = el('label', '', 'Start time');
  const start = el('input', 'input');
  start.type = 'time';
  start.value = formatTime(entry.start);
  start.dataset.stopEdit = `${entry.spot.id}:time`;
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
  length.dataset.stopEdit = `${entry.spot.id}:duration`;
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
  // Grid nằm trong div thường; không phụ thuộc cách trình duyệt bọc nội dung details.
  const fields = el('div', 'timeline-stop__fields');
  if (entry.venue) {
    const label = el('label', 'timeline-stop__wide', 'Restaurant');
    const select = el('select', 'input');
    select.dataset.stopEdit = `${entry.spot.id}:venue`;
    label.append(select);
    addOptions(select, sortedVenues(entry.spot, currentOrigin()), (option) => option.name, entry.venue.id);
    select.addEventListener('change', () => {
      stop().venueId = select.value;
      save(); renderTimeline();
    });
    fields.append(label);
  }
  fields.append(startLabel, lengthLabel, reset);
  details.append(fields);
  return details;
}

// Cầu nối dữ liệu và thuật toán: truyền điểm của ngày cùng các hàm tra món, quán và tọa độ.
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

// Ẩn link khi ngày trống; khi có điểm thì tạo tuyến Maps theo thứ tự lịch.
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
  ui['nearby-title'].textContent = items.length ? 'Ideas near your last stop' : `Ideas near ${origin.name}`;
  if (!ideas.length) {
    const full = currentStops().length >= MAX_STOPS_PER_DAY;
    ui.nearby.replaceChildren(el('p', 'plan-empty', full
      ? `This day already has ${MAX_STOPS_PER_DAY} stops. Remove one to see more ideas.`
      : 'No more suggestions fit the reference hours. Choose Food & drink, Places or Your own stop to add something manually.'));
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

// Thử thứ tự mới; chỉ nhận kết quả nếu khoảng cách giảm hơn 0,05 km, nếu không khôi phục thứ tự cũ.
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

// Tính lại lịch ngày đang chọn, cập nhật phần tóm tắt/gợi ý/bản in rồi dựng từng hàng điểm dừng.
function renderTimeline() {
  const focusedEdit = document.activeElement?.dataset.stopEdit;
  const { items, summary, origin, dateText: localDate } = scheduleFor(activeDay);
  renderTabs();
  ui['day-origin-name'].textContent = origin.name;
  ui['picker-target'].textContent = `Adding to Day ${activeDay + 1}. Choose a tour or add one stop at a time.`;
  ui['optimise-order'].disabled = items.length < 2;
  ui['plan-all'].hidden = trip.dayCount < 2 || trip.days.slice(0, trip.dayCount).every((day) => day.stops.length);
  updateTourButtons();
  renderSummary(summary, items);
  renderRouteLink(items, origin);
  renderPrintView();
  renderNearby(items, origin, localDate);
  if (!items.length) {
    const empty = el('div', 'plan-empty');
    empty.append(el('h4', '', 'A day to make your own.'), el('p', '', 'Start with a suggested tour or add your first stop. Arrival times will appear here automatically.'));
    const actions = el('div', 'plan-empty__actions');
    for (const [mode, label] of [['tours', 'Browse tours'], ['food', 'Add a first stop']]) {
      const button = el('button', 'button button--secondary', label);
      button.type = 'button';
      button.addEventListener('click', () => selectPicker(mode, true));
      actions.append(button);
    }
    empty.append(actions);
    ui.timeline.replaceChildren(empty);
    return;
  }

  const rows = items.map((entry, position) => {
    const { spot, venue, name, address, previous } = entry;
    const item = el('li', highlightId === spot.id ? 'timeline-stop timeline-stop--new' : 'timeline-stop');
    item.dataset.stop = spot.id;
    const time = el('time', 'timeline-stop__time', formatTime(entry.start));
    time.dateTime = `${localDate}T${formatTime(entry.start)}`;
    // Giờ đến và giờ rời đi cùng một cột để đọc nhanh toàn bộ lịch.
    const clock = el('div', 'timeline-stop__clock');
    clock.append(time, el('span', 'timeline-stop__end', `to ${formatTime(entry.end)}`));
    const body = el('div', 'timeline-stop__body');
    body.append(el('h3', '', spot.name));
    body.append(el('p', 'timeline-stop__details', venue ? name : `${SLOT_LABEL[entry.stop.slot]} · ${spot.kind === 'place' ? 'See & do' : 'Your own stop'}`));
    // Địa chỉ và khoảng cách cần thấy ngay, không bắt người dùng mở chi tiết.
    body.append(el('p', 'timeline-stop__address', address || 'No address added'));
    body.append(el('p', 'timeline-stop__travel', entry.noCoords
      ? 'Distance unknown. Check Google Maps.'
      : `~${entry.km.toFixed(1)} km straight-line from ${position === 0 ? origin.name : 'previous stop'}`));
    for (const warning of entry.warnings) body.append(el('p', 'timeline-stop__warning', warning));

    const actions = el('div', 'timeline-stop__actions');
    actions.append(link('Maps ↗', mapsDirections(previous, name, address)));
    actions.append(adjustPanel(entry));
    // Đổi thứ tự không cần mở form chỉnh sửa. Vẫn dùng cùng logic xếp lịch.
    const order = el('div', 'timeline-stop__order');
    order.setAttribute('role', 'group');
    order.setAttribute('aria-label', `Reorder ${spot.name}`);
    order.append(...moveButtons(entry, position, items.length));
    actions.append(order);
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
    item.append(clock, body);
    return item;
  });
  const list = el('ol', 'timeline-list');
  list.append(...rows);
  ui.timeline.replaceChildren(list);
  highlightId = null;
  // DOM vừa được thay mới: đưa focus về nút/ô vừa thao tác để người dùng bàn phím không bị mất vị trí.
  if (pendingFocus) {
    const [spotId, key] = pendingFocus.split(':');
    const target = [...ui.timeline.querySelectorAll('[data-move]')].find((button) => button.dataset.move === pendingFocus && !button.disabled)
      ?? ui.timeline.querySelector(`[data-move="${spotId}:${key === 'up' ? 'down' : 'up'}"]:not(:disabled)`);
    target?.focus();
    pendingFocus = null;
  } else if (focusedEdit) {
    [...ui.timeline.querySelectorAll('[data-stop-edit]')].find((field) => field.dataset.stopEdit === focusedEdit)?.focus({ preventScroll: true });
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

// Chụp bản cũ, thay các điểm của ngày bằng tour được chọn rồi lưu và cập nhật lịch.
function useTour(tour) {
  const hadStops = currentStops().length > 0;
  const restore = snapshotDay(activeDay);
  const stops = stopsForTour(tour, activeDay);
  if (!stops.length) return message('No spots left for this tour. Remove a stop from another day, or pick a different tour.');
  trip.days[activeDay].stops = stops;
  save();
  renderTimeline();
  message(`${tour.title} ${hadStops ? 'replaced the stops in' : 'added to'} day ${activeDay + 1}.`, restore);
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
  const reuse = trip.dayCount > 3 ? ` The guide has ${spots.length} spots, so later days may repeat favourites.` : '';
  message(`Filled ${filled} day${filled > 1 ? 's' : ''} with different tours.${reuse}`, undo);
}

/** Nhãn nhìn thấy và nhãn đọc màn hình luôn nói rõ thêm mới hay thay thế. */
function updateTourButtons() {
  for (const button of ui['tour-list'].querySelectorAll('[data-use-tour]')) {
    button.textContent = currentStops().length ? 'Replace with this tour' : `Use for Day ${activeDay + 1}`;
    button.setAttribute('aria-label', `${button.textContent}: ${button.dataset.tourTitle}`);
  }
}

// Ghép tour mẫu và tour tự lưu, dựng xem trước; yêu cầu xác nhận trong giao diện nếu thay ngày đã có điểm.
function renderTours() {
  const custom = readCustomTours();
  const origin = currentOrigin();
  const usedIds = usedElsewhere(activeDay);
  ui['tour-note'].textContent = `Full-day tours from ${origin.name}. Every stop is editable.`;
  ui['plan-all'].hidden = trip.dayCount < 2 || trip.days.slice(0, trip.dayCount).every((day) => day.stops.length);
  ui['tour-list'].replaceChildren(...[...TOURS, ...custom].map((tour) => {
    const card = el('article', tour.custom ? 'tour-card tour-card--custom' : 'tour-card');
    if (!tour.custom) card.append(picture(tour.image, tour.title));
    const body = el('div', 'tour-card__body');
    const stops = tour.custom ? tour.stops : buildTourStops(tour, { origin, spots, usedIds, getPoint: spotPoint });
    const names = stops.map((stop) => (stop.kind === 'custom' ? stop.name : byId.get(stop.spotId)?.name)).filter(Boolean);
    body.append(el('h4', '', tour.title), el('p', '', tour.custom ? 'Your saved tour' : tour.description));
    if (names.length) {
      const preview = el('details', 'tour-card__preview');
      preview.append(el('summary', '', `Preview ${names.length} stops`), el('p', 'tour-card__stops', names.join(' → ')));
      body.append(preview);
    }
    const button = el('button', 'button button--secondary', 'Use this tour');
    button.dataset.useTour = tour.id;
    button.dataset.tourTitle = tour.title;
    button.type = 'button';
    button.addEventListener('click', () => {
      if (!currentStops().length) return useTour(tour);
      confirmChange(`Replace Day ${activeDay + 1}?`, `${tour.title} will replace the ${currentStops().length} stops currently in this day. Other days stay unchanged. You can undo afterward.`, 'Replace stops', () => useTour(tour));
    });
    body.append(button);
    if (tour.custom) {
      const remove = el('button', 'text-action', 'Delete tour');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Delete tour ${tour.title}`);
      remove.addEventListener('click', () => confirmChange('Delete this saved tour?', `"${tour.title}" will be removed from your saved tours. Stops already in your itinerary will stay.`, 'Delete tour', () => updateLibrary(() => {
        deleteCustomTour(tour.id); renderTours(); message(`Tour "${tour.title}" deleted.`);
      })));
      body.append(remove);
    }
    card.append(body);
    return card;
  }));
  updateTourButtons();
}

/** Thư viện cũng có thể hết dung lượng; giữ form và báo lỗi thay vì làm mất nội dung. */
function updateLibrary(action) {
  try { action(); }
  catch { message('Could not update saved plans or tours on this device. Keep this tab open and try a share link from Tools.'); }
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

// Dựng danh sách lịch có tên với nút mở/xóa; mở bản lưu thay toàn bộ lịch đang chỉnh.
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
      const open = () => {
        const notice = replaceTrip(plan.trip, `"${plan.name}" opened.`);
        render(); message(notice.text, notice.undo);
      };
      if (trip.days.some((day) => day.stops.length)) {
        confirmChange('Open this saved plan?', `"${plan.name}" will replace the plan you are editing. Save your current plan first if you want to keep both.`, 'Open plan', open);
      } else open();
    });
    const remove = el('button', 'text-action', 'Delete');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Delete saved plan ${plan.name}`);
    remove.addEventListener('click', () => confirmChange('Delete this saved plan?', `The saved copy of "${plan.name}" will be deleted. Your current itinerary stays unchanged.`, 'Delete saved plan', () => updateLibrary(() => {
      deletePlan(plan.id); renderSavedPlans(); message(`"${plan.name}" deleted.`);
    })));
    row.append(text, load, remove);
    return row;
  }));
}

// Đồng bộ ngày bắt đầu, ngày kết thúc và số ngày, đồng thời đặt giới hạn cho ô ngày kết thúc.
function renderDates() {
  ui['start-date'].value = trip.startDate;
  ui['end-date'].value = addDays(trip.startDate, trip.dayCount - 1);
  ui['end-date'].min = trip.startDate;
  ui['end-date'].max = addDays(trip.startDate, MAX_DAYS - 1);
  ui['day-count'].value = String(trip.dayCount);
  ui['trip-range'].textContent = trip.dayCount === 1
    ? 'Your trip ends on the same day.'
    : `Your trip ends on ${dateForDay(trip.startDate, trip.dayCount - 1)}.`;
}

// Cập nhật toàn bộ giao diện từ trip; gọi khi đổi ngày hoặc thay cấu hình của chuyến đi.
function render() {
  settingsError(null, '');
  renderDates();
  ui['day-title'].textContent = `Day ${activeDay + 1}: ${dateForDay(trip.startDate, activeDay)}`;
  renderOrigins(); renderVenues(); renderPreview('place'); renderTours(); renderSavedPlans(); renderTimeline();
}

/** Kiểm tra ngay cạnh trường sai; không tự sửa ngày âm/số ngày lẻ mà không báo. */
function settingsError(field, text) {
  for (const id of ['start-date', 'end-date', 'day-count']) ui[id].removeAttribute('aria-invalid');
  if (field) ui[field].setAttribute('aria-invalid', 'true');
  ui['settings-error'].textContent = text;
}
// SỰ KIỆN CẤU HÌNH: kiểm tra đầu vào trước khi sửa trip, sau đó lưu và vẽ lại.
ui['start-date'].addEventListener('change', () => {
  if (!ui['start-date'].value || !ui['start-date'].validity.valid) return settingsError('start-date', 'Choose a valid starting date. Your current plan has not changed.');
  settingsError(null, '');
  trip.startDate = ui['start-date'].value;
  save(); render();
});
/** Đổi số ngày (từ ô số hoặc ngày kết thúc); giữ dữ liệu các ngày bị ẩn để bật lại khi tăng số ngày. */
function setDayCount(days, field = 'day-count') {
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return settingsError(field, field === 'end-date'
      ? `Choose an ending date within ${MAX_DAYS} days, on or after the starting date.`
      : `Enter a whole number from 1 to ${MAX_DAYS}. Your current plan has not changed.`);
  }
  settingsError(null, '');
  const previousCount = trip.dayCount;
  const count = Math.min(days, MAX_DAYS);
  trip.dayCount = count;
  ensureDays(trip, count);
  activeDay = Math.min(activeDay, count - 1);
  save(); render();
  if (count < previousCount) message(`Showing ${count} day${count > 1 ? 's' : ''}. Increase the number again to restore hidden days and their stops.`);
}

ui['day-count'].addEventListener('change', () => setDayCount(Number(ui['day-count'].value)));
ui['end-date'].addEventListener('change', () => {
  const value = ui['end-date'].value;
  if (!value) return settingsError('end-date', 'Choose an ending date. Your current plan has not changed.');
  setDayCount(daysBetween(trip.startDate, value) + 1, 'end-date');
});
// Đổi mốc chỉ tính lại khoảng cách/gợi ý; giữ các quán và điểm đã chọn.
function originChanged() {
  save(); render();
  message(`Day ${activeDay + 1} starts from ${currentOrigin().name}. Your selected stops and restaurants stay unchanged. Distances and suggestions have been updated.`);
}
ui['day-origin'].addEventListener('change', () => { trip.days[activeDay].originId = ui['day-origin'].value || null; originChanged(); });
ui['trip-origin'].addEventListener('change', () => { trip.originId = ui['trip-origin'].value; originChanged(); });
ui['plan-all'].addEventListener('click', planEmptyDays);
ui['food-choice'].addEventListener('change', () => renderVenues(''));
ui['venue-choice'].addEventListener('change', () => renderPreview('food'));
ui['place-choice'].addEventListener('change', () => renderPreview('place'));
ui['custom-time'].addEventListener('input', () => { ui['custom-slot'].disabled = Boolean(ui['custom-time'].value); });

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
  const restore = snapshotDay(activeDay);
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
  message(`${label} added to day ${activeDay + 1}${when}.${also}`, restore);
  return true;
}

// SỰ KIỆN THÊM ĐIỂM: preventDefault ngăn form tải lại trang; chuyển dữ liệu form cho addStop.
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
    ui['custom-slot'].disabled = false;
    ui['custom-length'].value = '60';
    ui['custom-name'].focus({ preventScroll: true });
  }
});

// Thử sao chép bằng Clipboard API; nếu trình duyệt từ chối thì hiện ô để người dùng tự copy.
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

// Tạo chuỗi ICS của các ngày có điểm, tạo URL Blob tạm để tải, rồi giải phóng URL đó.
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
document.getElementById('library-link').addEventListener('click', () => { ui['plan-library'].open = true; });
ui['open-library'].addEventListener('click', () => {
  ui['plan-library'].open = true;
  ui['plan-library'].scrollIntoView({ block: 'start' });
  ui['plan-name'].focus({ preventScroll: true });
});
// Lưu một bản lịch có tên trong thư viện, tách với cơ chế tự lưu lịch đang sửa.
document.querySelector('#save-plan').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!trip.days.slice(0, trip.dayCount).some((day) => day.stops.length)) return message('Add at least one stop before saving a plan.');
  updateLibrary(() => {
    const result = savePlan(ui['plan-name'].value, trip);
    if (result.error) return message(result.error);
    ui['plan-name'].value = '';
    renderSavedPlans();
    message(result.replaced ? 'Saved plan updated.' : 'Plan saved. Open it later from "Saved plans and my tours".');
  });
});
document.querySelector('#new-plan').addEventListener('click', () => {
  const start = () => {
    const notice = replaceTrip(normalizeTrip(null), 'Started a new empty plan. Your named saved plans are unchanged.');
    render(); message(notice.text, notice.undo);
  };
  if (trip.days.some((day) => day.stops.length)) {
    confirmChange('Start a new plan?', 'This clears the plan you are editing. Save it first if you want to keep a named copy. You can also undo after starting over.', 'Start new plan', start);
  } else start();
});
// Lấy điểm của ngày hiện tại theo thứ tự hiển thị để tạo tour dùng lại.
document.querySelector('#save-tour').addEventListener('submit', (event) => {
  event.preventDefault();
  updateLibrary(() => {
    const stops = orderStops(currentStops()).map((entry) => entry.stop);
    const result = addCustomTour(ui['tour-name'].value, stops);
    if (result.error) return message(result.error);
    ui['tour-name'].value = '';
    renderTours();
    message(`Tour "${result.tours.at(-1).title}" saved. Use it on any day.`);
  });
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
  // KHỞI TẠO: đợi danh mục từ API rồi mới đọc lựa chọn trong URL và bật form.
  spots = await loadSpots();
  byId = new Map(spots.map((spot) => [spot.id, spot]));
  const sharedNotice = applySharedTrip();
  const removed = pruneTrip(trip, new Set(byId.keys()));
  if (removed || sharedNotice) save();
  const saved = new Set(readFavorites());
  addOptions(ui['food-choice'], spots.filter((spot) => spot.kind === 'food'),
    (spot) => saved.has(spot.id) ? `♥ ${spot.name}` : spot.name);
  addOptions(ui['place-choice'], spots.filter((spot) => spot.kind === 'place'), (spot) => spot.name);
  // Link từ Food/Places chỉ điền sẵn lựa chọn; link tour có thể áp dụng ngay nếu ngày đầu trống.
  const params = new URLSearchParams(location.search);
  if (byId.get(params.get('food'))?.kind === 'food') ui['food-choice'].value = params.get('food');
  if (byId.get(params.get('place'))?.kind === 'place') ui['place-choice'].value = params.get('place');
  if (params.has('food') || params.has('venue')) selectPicker('food');
  else if (params.has('place')) selectPicker('place');
  render();
  if (sharedNotice) message(sharedNotice.text, sharedNotice.undo);
  else if (removed) message(`${removed} saved stop${removed > 1 ? 's' : ''} no longer in the guide ${removed > 1 ? 'were' : 'was'} removed from your plan.`);
  if (params.get('venue')) renderVenues(params.get('venue'));
  if (params.get('tour')) {
    const selected = TOURS.find((tour) => tour.id === params.get('tour'));
    if (selected && !currentStops().length) useTour(selected);
    else if (selected) message(`Day 1 already has stops. Use the ${selected.title} button to replace them.`);
  }
  // Bỏ inert sau khi tải thành công để các nút không bị thao tác khi thiếu dữ liệu.
  for (const id of ['trip-setup', 'planner-workspace', 'plan-library']) document.getElementById(id).inert = false;
} catch (error) {
  document.getElementById('planner-error').hidden = false;
} finally {
  document.getElementById('planner-loading').hidden = true;
}
document.getElementById('retry-load').addEventListener('click', () => location.reload());
