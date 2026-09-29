/** Unit tests cho logic xếp lịch. Không cần server hay trình duyệt. */
import assert from 'node:assert/strict';
import { DAY_END, MAX_STOPS_PER_DAY, insertStopByTime, moveStop, slotForTime, openingWarning, optimizeOrder, scheduleDay, suggestNearby, travelMinutes } from '../source/frontend/public/scripts/shared/schedule.js';
import { MAX_DAYS, TOURS, isValidStop, mapsDirections, placeText, addDays, dayUsingSpot, daysBetween, ensureDays, mapsRoute, normalizeTrip, pruneTrip } from '../source/frontend/public/scripts/shared/guide.js';
import { buildIcs, escapeIcsText, foldLine, icsLocalTime } from '../source/frontend/public/scripts/shared/calendar.js';
import { buildTourStops } from '../source/frontend/public/scripts/shared/tours.js';
import {
  MAX_CUSTOM_TOURS, MAX_SAVED_PLANS, addCustomTour, deleteCustomTour, deletePlan, readCustomTours, readSavedPlans, savePlan,
} from '../source/frontend/public/scripts/shared/library.js';
import { decodeTrip, encodeTrip, sharedTripFromHash } from '../source/frontend/public/scripts/shared/share.js';

let checks = 0;
const test = (name, run) => { run(); checks += 1; console.log(`ok - ${name}`); };

const MONDAY = '2026-09-28';
const TUESDAY = '2026-09-29';
const FRIDAY = '2026-10-02';
const origin = { lat: 21.029, lng: 105.852 };
const spots = new Map([
  ['pho', { id: 'pho', kind: 'food', name: 'Pho', district: 'Hoan Kiem', openingHours: '06:00 - 10:30, 18:00 - 20:30' }],
  ['lake', { id: 'lake', kind: 'place', name: 'Lake', district: 'Hoan Kiem', admission: 50000, durationMinutes: 90, lat: 21.029, lng: 105.852, openingHours: 'Open all day' }],
  ['citadel', { id: 'citadel', kind: 'place', name: 'Citadel', district: 'Ba Dinh', admission: 100000, durationMinutes: 90, lat: 21.036, lng: 105.84, openingHours: '08:00 - 17:00, closed Monday' }],
  ['long', { id: 'long', kind: 'place', name: 'Long', district: 'Ba Dinh', admission: 0, durationMinutes: 300, lat: 21.036, lng: 105.84, openingHours: 'Open all day' }],
]);
const venue = { id: 'v', name: 'Pho shop', address: 'x', district: 'Hoan Kiem', lat: 21.033, lng: 105.846 };
const run = (stops, dateText = TUESDAY) => scheduleDay({
  stops, origin, dateText,
  getSpot: (id) => spots.get(id),
  getVenue: () => venue,
  getPoint: (spot, v) => v ?? spot,
});

test('travelMinutes is at least 10 and rounds up to 5', () => {
  assert.equal(travelMinutes(0), 10);
  assert.equal(travelMinutes(0.4) % 5, 0);
  assert.ok(travelMinutes(5) > travelMinutes(1));
});

test('stops are ordered by slot, first stop starts at the slot start', () => {
  const { items } = run([
    { kind: 'place', spotId: 'lake', slot: 'afternoon' },
    { kind: 'food', spotId: 'pho', slot: 'morning' },
  ]);
  assert.deepEqual(items.map((item) => item.spot.id), ['pho', 'lake']);
  assert.equal(items[0].start, 8 * 60);
  assert.equal(items[1].start, 12 * 60);
});

test('a long stop pushes the next stop later and warns', () => {
  const { items } = run([
    { kind: 'place', spotId: 'long', slot: 'morning' },
    { kind: 'place', spotId: 'lake', slot: 'afternoon' },
  ]);
  assert.ok(items[1].start > 12 * 60);
  assert.ok(items[1].warnings.some((text) => text.startsWith('Runs late')));
});

test('a small delay between two stops is not flagged as late', () => {
  const { items } = run([
    { kind: 'food', spotId: 'pho', slot: 'morning' },
    { kind: 'place', spotId: 'lake', slot: 'morning' },
  ]);
  assert.equal(items[1].warnings.some((text) => text.startsWith('Runs late')), false);
});

test('a stop ending after the day end warns', () => {
  const { items } = run([{ kind: 'place', spotId: 'long', slot: 'evening' }]);
  assert.ok(items[0].end > DAY_END);
  assert.ok(items[0].warnings.some((text) => text.includes('after 22:00')));
});

test('summary totals stops, entry fees and end time', () => {
  const { summary } = run([
    { kind: 'place', spotId: 'lake', slot: 'morning' },
    { kind: 'place', spotId: 'citadel', slot: 'afternoon' },
  ]);
  assert.equal(summary.stopCount, 2);
  assert.equal(summary.admissionTotal, 150000);
  assert.equal(summary.startMinutes, 8 * 60);
  assert.equal(summary.endMinutes, 12 * 60 + 90);
});

test('unknown spots are skipped', () => {
  assert.equal(run([{ kind: 'place', spotId: 'gone', slot: 'morning' }]).items.length, 0);
});

test('food opening hours are checked too', () => {
  const { items } = run([{ kind: 'food', spotId: 'pho', slot: 'afternoon' }]);
  assert.ok(items[0].warnings.some((text) => text.startsWith('Outside listed hours')));
  assert.equal(run([{ kind: 'food', spotId: 'pho', slot: 'morning' }]).items[0].warnings.length, 0);
});

test('openingWarning: Monday closure, Friday afternoon, all day, overnight', () => {
  assert.match(openingWarning('08:00 - 17:00, closed Monday', MONDAY, 600, 690), /Monday/);
  assert.equal(openingWarning('08:00 - 17:00, closed Monday', TUESDAY, 600, 690), '');
  const combined = '07:30 - 10:30, closed Monday and Friday afternoon';
  assert.match(openingWarning(combined, MONDAY, 480, 540), /Monday/);
  assert.match(openingWarning('08:00 - 17:00, closed Friday afternoon', FRIDAY, 13 * 60, 14 * 60), /Friday/);
  assert.equal(openingWarning('Open all day', TUESDAY, 0, 1400), '');
  assert.equal(openingWarning('18:00 - 02:00', TUESDAY, 23 * 60, 24 * 60 + 30), '');
  assert.equal(openingWarning('', TUESDAY, 0, 60), '');
});

test('pruneTrip drops unknown spots; dayUsingSpot ignores hidden days', () => {
  const trip = { dayCount: 2, days: [
    { stops: [{ spotId: 'a' }, { spotId: 'gone' }] },
    { stops: [{ spotId: 'b' }] },
    { stops: [{ spotId: 'c' }] },
  ] };
  assert.equal(pruneTrip(trip, new Set(['a', 'b', 'c'])), 1);
  assert.equal(trip.days[0].stops.length, 1);
  assert.equal(dayUsingSpot(trip, 'b', 0), 1);
  assert.equal(dayUsingSpot(trip, 'b', 1), -1);
  assert.equal(dayUsingSpot(trip, 'c'), -1);
});

test('moveStop swaps inside a slot without touching the input', () => {
  const stops = [
    { kind: 'place', spotId: 'lake', slot: 'morning' },
    { kind: 'place', spotId: 'citadel', slot: 'morning' },
  ];
  const moved = moveStop(stops, 1, -1);
  assert.deepEqual(moved.map((stop) => stop.spotId), ['citadel', 'lake']);
  assert.equal(stops[0].spotId, 'lake');
  assert.deepEqual(moveStop(stops, 0, -1), stops);
});

test('moveStop across a slot boundary adopts the neighbour slot', () => {
  const stops = [
    { kind: 'place', spotId: 'lake', slot: 'morning' },
    { kind: 'place', spotId: 'citadel', slot: 'afternoon' },
    { kind: 'place', spotId: 'long', slot: 'afternoon' },
  ];
  const up = moveStop(stops, 1, -1);
  assert.deepEqual(up.map((stop) => [stop.spotId, stop.slot]), [['citadel', 'morning'], ['lake', 'morning'], ['long', 'afternoon']]);
  const down = moveStop(stops, 0, 1);
  assert.deepEqual(down.map((stop) => [stop.spotId, stop.slot]), [['citadel', 'afternoon'], ['lake', 'afternoon'], ['long', 'afternoon']]);
});

test('a pinned start and custom duration override automatic timing', () => {
  const { items } = run([{ kind: 'place', spotId: 'lake', slot: 'morning', startTime: 9 * 60 + 30, duration: 30 }]);
  assert.equal(items[0].start, 9 * 60 + 30);
  assert.equal(items[0].end, 10 * 60);
  assert.equal(items[0].pinned, true);
});

test('a pinned start too soon after the previous stop warns', () => {
  const { items } = run([
    { kind: 'place', spotId: 'lake', slot: 'morning' },
    { kind: 'place', spotId: 'citadel', slot: 'morning', startTime: 9 * 60 + 30 },
  ]);
  assert.ok(items[1].warnings.some((text) => text.startsWith('Not enough time')));
});

test('mapsRoute puts the last stop as destination and the rest as waypoints', () => {
  const stops = [{ name: 'A', address: 'a1' }, { name: 'B', address: 'b1' }, { name: 'C', address: 'c1' }];
  const url = new URL(mapsRoute({ name: 'Start' }, stops));
  assert.equal(url.searchParams.get('destination'), 'C, c1, Hanoi, Vietnam');
  assert.equal(url.searchParams.get('waypoints'), 'A, a1, Hanoi, Vietnam|B, b1, Hanoi, Vietnam');
  assert.equal(new URL(mapsRoute({ name: 'Start' }, stops.slice(0, 1))).searchParams.has('waypoints'), false);
  assert.equal(mapsRoute({ name: 'Start' }, []), '');
});

const sampleTrip = () => normalizeTrip({
  startDate: '2026-10-01', dayCount: 2, originId: 'old-quarter',
  days: [
    { originId: null, stops: [{ kind: 'food', spotId: 'food-pho-bo', slot: 'morning', venueId: 'pho-bat-dan', startTime: 480, duration: 45 }] },
    { originId: 'west-lake', stops: [{ kind: 'place', spotId: 'place-tran-quoc-pagoda', slot: 'afternoon' }] },
  ],
});

test('share link round-trips a trip, including Vietnamese-free ids and custom times', () => {
  const trip = sampleTrip();
  const decoded = decodeTrip(encodeTrip(trip));
  assert.equal(decoded.dayCount, 2);
  assert.equal(decoded.originId, 'old-quarter');
  assert.deepEqual(decoded.days[0].stops, trip.days[0].stops);
  assert.equal(decoded.days[1].originId, 'west-lake');
});

test('share link rejects garbage, oversized and empty plans', () => {
  assert.equal(decodeTrip('not base64!'), null);
  assert.equal(decodeTrip('a'.repeat(41000)), null);
  assert.equal(decodeTrip(encodeTrip(normalizeTrip(null))), null);
  assert.equal(decodeTrip(Buffer.from('{"days":"x"}').toString('base64url')), null);
});

test('share link cleans hostile stop data', () => {
  const evil = Buffer.from(JSON.stringify({ startDate: '2026-10-01', dayCount: 99, originId: '<x>', days: [{ stops: [
    { kind: 'food', slot: 'morning', spotId: 'food-pho-bo', startTime: 99999, duration: -5, extra: '<script>' },
    { kind: 'bad', slot: 'morning', spotId: 'x' },
  ] }] })).toString('base64url');
  const trip = decodeTrip(evil);
  assert.equal(trip.dayCount, 1);
  assert.equal(trip.originId, 'hoan-kiem');
  assert.deepEqual(trip.days[0].stops, [{ kind: 'food', spotId: 'food-pho-bo', slot: 'morning' }]);
});

test('sharedTripFromHash distinguishes absent, invalid and valid', () => {
  assert.deepEqual(sharedTripFromHash(''), { present: false, trip: null });
  assert.deepEqual(sharedTripFromHash('#plan=%%%'), { present: true, trip: null });
  assert.equal(sharedTripFromHash(`#plan=${encodeTrip(sampleTrip())}`).trip.dayCount, 2);
});

test('icsLocalTime rolls over midnight and escaping/folding follow RFC 5545', () => {
  assert.equal(icsLocalTime('2026-10-01', 8 * 60 + 5), '20261001T080500');
  assert.equal(icsLocalTime('2026-10-01', 24 * 60 + 30), '20261002T003000');
  assert.equal(escapeIcsText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const long = `X:${'Hà Nội '.repeat(30)}`;
  const folded = foldLine(long);
  for (const part of folded.split('\r\n')) assert.ok(new TextEncoder().encode(part).length <= 75);
  assert.equal(folded.replaceAll('\r\n ', ''), long);
});

test('buildIcs writes one VEVENT per stop with local times and CRLF endings', () => {
  const { items } = run([
    { kind: 'food', spotId: 'pho', slot: 'morning' },
    { kind: 'place', spotId: 'lake', slot: 'afternoon' },
  ]);
  const text = buildIcs([{ dateText: TUESDAY, items }], { now: new Date('2026-09-29T00:00:00Z'), mapsLink: () => 'https://maps.example/x' });
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.equal(text.match(/BEGIN:VEVENT/g).length, 2);
  assert.ok(text.includes('DTSTART:20260929T080000'));
  assert.ok(text.includes('DTEND:20260929T085000'));
  assert.ok(text.includes('DTSTAMP:20260929T000000Z'));
  assert.ok(text.includes('SUMMARY:Pho at Pho shop'));
  assert.ok(text.endsWith('END:VCALENDAR\r\n'));
  assert.equal(new Set(text.match(/UID:.+/g)).size, 2);
});

const near = { id: 'near', kind: 'place', name: 'Near', district: 'Hoan Kiem', durationMinutes: 45, lat: 21.0295, lng: 105.8525, openingHours: '08:00 - 17:00' };
const far = { id: 'far', kind: 'place', name: 'Far', district: 'Tay Ho', durationMinutes: 45, lat: 21.06, lng: 105.80, openingHours: 'Open all day' };
const opts = { origin, getSpot: (id) => ({ near, far, ...Object.fromEntries(spots) })[id], getVenue: () => venue, getPoint: (spot, v) => v ?? spot };

test('optimizeOrder visits the nearest stop first inside a slot and keeps slots', () => {
  const stops = [
    { kind: 'place', spotId: 'far', slot: 'morning' },
    { kind: 'place', spotId: 'near', slot: 'morning' },
    { kind: 'place', spotId: 'lake', slot: 'afternoon' },
  ];
  const result = optimizeOrder(stops, opts);
  assert.deepEqual(result.map((stop) => stop.spotId), ['near', 'far', 'lake']);
  assert.deepEqual(result.map((stop) => stop.slot), ['morning', 'morning', 'afternoon']);
  assert.equal(stops[0].spotId, 'far');
});

test('optimizeOrder never moves a stop with a pinned start', () => {
  const stops = [
    { kind: 'place', spotId: 'far', slot: 'morning', startTime: 540 },
    { kind: 'place', spotId: 'citadel', slot: 'morning' },
    { kind: 'place', spotId: 'near', slot: 'morning' },
  ];
  const result = optimizeOrder(stops, opts);
  assert.equal(result[0].spotId, 'far');
  assert.equal(result[1].spotId, 'near');
});

test('suggestNearby ranks by distance and skips used, closed and full days', () => {
  const { items } = run([{ kind: 'place', spotId: 'lake', slot: 'morning' }]);
  const pool = [near, far, { ...near, id: 'closed', openingHours: '08:00 - 09:00' }, { ...near, id: 'used' }];
  const base = { items, origin, spots: pool, usedIds: new Set(['lake', 'used']), dateText: TUESDAY, getPoint: (spot, v) => v ?? spot };
  assert.deepEqual(suggestNearby(base).map((entry) => entry.spot.id), ['near', 'far']);
  assert.equal(suggestNearby({ ...base, limit: 1 }).length, 1);
  assert.equal(suggestNearby({ ...base, items: Array(MAX_STOPS_PER_DAY).fill(items[0]) }).length, 0);
});

test('suggestNearby still fills the list with spots used on other days, after unused ones', () => {
  const { items } = run([{ kind: 'place', spotId: 'lake', slot: 'morning' }]);
  const pool = [near, far, { ...near, id: 'other-day', lat: 21.0293, lng: 105.8521 }];
  const base = { items, origin, spots: pool, usedIds: new Set(['lake']), dateText: TUESDAY, getPoint: (spot, v) => v ?? spot };
  const ids = suggestNearby({ ...base, elsewhereIds: new Set(['other-day']) }).map((entry) => entry.spot.id);
  assert.deepEqual(ids, ['near', 'far', 'other-day']);
  const flagged = suggestNearby({ ...base, elsewhereIds: new Set(['other-day']) }).find((entry) => entry.spot.id === 'other-day');
  assert.equal(flagged.elsewhere, true);
  const all = suggestNearby({ ...base, spots: [{ ...near, id: 'only-elsewhere' }], elsewhereIds: new Set(['only-elsewhere']) });
  assert.equal(all.length, 1);
});

test('suggestNearby picks the nearest restaurant of a dish and a valid slot', () => {
  const dish = { id: 'dish', kind: 'food', name: 'Dish', openingHours: '06:00 - 22:00', venues: [
    { id: 'a', name: 'Far shop', address: 'x', district: 'Tay Ho', lat: 21.06, lng: 105.80 },
    { id: 'b', name: 'Close shop', address: 'y', district: 'Hoan Kiem', lat: 21.0292, lng: 105.8521 },
  ] };
  const [pick] = suggestNearby({ items: [], origin, spots: [dish], usedIds: new Set(), dateText: TUESDAY, getPoint: (spot, v) => v ?? spot });
  assert.equal(pick.venue.id, 'b');
  assert.equal(pick.slot, 'morning');
  assert.equal(pick.start, 8 * 60);
});

const fakeStorage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) };
};

test('saved plans: save, overwrite by name, delete, limit', () => {
  const storage = fakeStorage();
  const trip = sampleTrip();
  assert.deepEqual(readSavedPlans(storage), []);
  savePlan('  Weekend  ', trip, storage, 1000);
  assert.equal(readSavedPlans(storage).length, 1);
  assert.equal(readSavedPlans(storage)[0].name, 'Weekend');
  const again = savePlan('weekend', trip, storage, 2000);
  assert.equal(again.replaced, true);
  assert.equal(readSavedPlans(storage).length, 1);
  assert.equal(readSavedPlans(storage)[0].savedAt, 2000);
  assert.equal(savePlan('', trip, storage).plans[0].name, 'Plan 2026-10-01');
  assert.equal(deletePlan(readSavedPlans(storage)[0].id, storage).length, 1);
  for (let index = 0; index < MAX_SAVED_PLANS; index += 1) savePlan(`p${index}`, trip, storage);
  assert.match(savePlan('one more', trip, storage).error, /up to/);
  assert.equal(readSavedPlans(storage).length, MAX_SAVED_PLANS);
});

test('saved plans are copies and are sanitised on read', () => {
  const storage = fakeStorage();
  const trip = sampleTrip();
  savePlan('Copy', trip, storage);
  trip.days[0].stops.length = 0;
  assert.equal(readSavedPlans(storage)[0].trip.days[0].stops.length, 1);
  storage.setItem('hanoi-local-saved-plans-v1', JSON.stringify([{ id: 1, name: 'bad' }, { id: 'ok', name: 'x'.repeat(100), trip: 'nope' }]));
  const [plan] = readSavedPlans(storage);
  assert.equal(plan.name.length, 40);
  assert.equal(plan.trip.days.every((day) => day.stops.length === 0), true);
  storage.setItem('hanoi-local-saved-plans-v1', 'not json');
  assert.deepEqual(readSavedPlans(storage), []);
});

test('custom tours: need stops, keep only safe fields, delete, limit', () => {
  const storage = fakeStorage();
  assert.match(addCustomTour('Empty', [], storage).error, /at least one/);
  const stops = [{ kind: 'food', spotId: 'food-pho-bo', slot: 'morning', venueId: 'v', startTime: 480, duration: 30 }];
  const { tours } = addCustomTour('Lazy day', stops, storage);
  assert.deepEqual(tours[0].stops, [{ kind: 'food', spotId: 'food-pho-bo', slot: 'morning' }]);
  assert.equal(tours[0].custom, true);
  assert.equal(readCustomTours(storage)[0].title, 'Lazy day');
  assert.equal(deleteCustomTour(tours[0].id, storage).length, 0);
  for (let index = 0; index < MAX_CUSTOM_TOURS; index += 1) addCustomTour(`t${index}`, stops, storage);
  assert.match(addCustomTour('extra', stops, storage).error, /up to/);
});

test('addDays and daysBetween handle month ends and DST-free math', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-09-29', '2026-10-05'), 6);
  assert.equal(daysBetween('2026-10-05', '2026-09-29'), -6);
  assert.equal(daysBetween('2026-10-01', '2026-10-01'), 0);
});

test('trips can have up to MAX_DAYS days; more or fewer is rejected', () => {
  const trip = normalizeTrip({ startDate: '2026-10-01', dayCount: 10, originId: 'hoan-kiem', days: [] });
  assert.equal(trip.dayCount, 10);
  assert.equal(trip.days.length, 10);
  assert.equal(normalizeTrip({ dayCount: MAX_DAYS, days: [] }).dayCount, MAX_DAYS);
  assert.equal(normalizeTrip({ dayCount: MAX_DAYS + 1, days: [] }).dayCount, 1);
  assert.equal(normalizeTrip({ dayCount: 0, days: [] }).dayCount, 1);
  assert.equal(normalizeTrip({ dayCount: 2.5, days: [] }).dayCount, 1);
  ensureDays(trip, 12);
  assert.equal(trip.days.length, 12);
});

test('a longer trip keeps its stops through share link encoding', () => {
  const days = Array.from({ length: 12 }, (_, index) => ({ originId: null, stops: [{ kind: 'place', spotId: `place-${index}`, slot: 'morning' }] }));
  const decoded = decodeTrip(encodeTrip(normalizeTrip({ startDate: '2026-10-01', dayCount: 12, originId: 'hoan-kiem', days })));
  assert.equal(decoded.dayCount, 12);
  assert.equal(decoded.days[11].stops[0].spotId, 'place-11');
});

// Bộ dữ liệu nhỏ có tọa độ thật của Hà Nội: trung tâm (Hoàn Kiếm) và Tây Hồ.
const mk = (id, kind, category, lat, lng, extra = {}) => ({ id, kind, category, name: id, lat, lng, ...extra });
const shop = (id, lat, lng) => ({ id, name: id, address: 'x', district: 'x', lat, lng });
const tourPool = [
  mk('f-noodle-a', 'food', 'Noodles', 21.033, 105.846, { venues: [shop('na', 21.033, 105.846)] }),
  mk('f-noodle-b', 'food', 'Noodles', 21.06, 105.83, { venues: [shop('nb', 21.06, 105.83)] }),
  mk('f-grill-a', 'food', 'Grilled', 21.031, 105.847, { venues: [shop('ga', 21.031, 105.847)] }),
  mk('f-grill-b', 'food', 'Grilled', 21.058, 105.829, { venues: [shop('gb', 21.058, 105.829)] }),
  mk('f-coffee-a', 'food', 'Coffee', 21.034, 105.854, { venues: [shop('ca', 21.034, 105.854)] }),
  mk('f-coffee-b', 'food', 'Coffee', 21.056, 105.833, { venues: [shop('cb', 21.056, 105.833)] }),
  mk('p-lake', 'place', 'Landmark', 21.029, 105.852),
  mk('p-quarter', 'place', 'Neighbourhood', 21.035, 105.849),
  mk('p-pagoda', 'place', 'Pagoda', 21.048, 105.837),
  mk('p-bridge', 'place', 'Landmark', 21.041, 105.86),
];
const build = (tour, origin, usedIds) => buildTourStops(tour, { origin, spots: tourPool, usedIds, getPoint: (spot, v) => v ?? spot });
const quarterTour = TOURS.find((tour) => tour.id === 'old-quarter');
const centre = { lat: 21.029, lng: 105.852 };
const westLake = { lat: 21.055, lng: 105.832 };

test('tour stops follow the pattern with slots and a restaurant for each dish', () => {
  const stops = build(quarterTour, centre);
  assert.deepEqual(stops.map((stop) => stop.slot), quarterTour.pattern.map((step) => step.slot));
  assert.deepEqual(stops.map((stop) => stop.kind), quarterTour.pattern.map((step) => step.kind));
  assert.ok(stops.filter((stop) => stop.kind === 'food').every((stop) => stop.venueId));
  assert.equal(new Set(stops.map((stop) => stop.spotId)).size, stops.length);
});

test('the same tour gives different stops for different start points', () => {
  const near = build(quarterTour, centre).map((stop) => stop.spotId);
  const far = build(quarterTour, westLake).map((stop) => stop.spotId);
  assert.notDeepEqual(near, far);
  assert.equal(near[0], 'f-noodle-a');
  assert.equal(far[0], 'f-noodle-b');
});

test('tours for different days never repeat a spot while unused spots remain', () => {
  const used = new Set();
  const days = TOURS.slice(0, 2).map((tour) => {
    const stops = build(tour, centre, used);
    stops.forEach((stop) => used.add(stop.spotId));
    return stops.map((stop) => stop.spotId);
  });
  assert.equal(days[0].filter((id) => days[1].includes(id)).length, 0);
  assert.ok(days[1].length >= 2);
});

test('a partly used pool keeps unused spots and reuses only what is missing', () => {
  const used = new Set(['f-noodle-a', 'f-noodle-b', 'f-grill-a', 'f-grill-b', 'p-lake', 'p-quarter', 'p-bridge']);
  const stops = build(quarterTour, centre, used);
  assert.equal(stops.length, quarterTour.pattern.length);
  assert.ok(stops.some((stop) => !used.has(stop.spotId)));
  assert.equal(new Set(stops.map((stop) => stop.spotId)).size, stops.length);
});

test('when unused spots run out, a tour reuses favourites instead of coming back empty', () => {
  const everything = new Set(tourPool.map((spot) => spot.id));
  const stops = build(quarterTour, centre, everything);
  assert.equal(stops.length, quarterTour.pattern.length);
});

const dish = (over = {}) => ({ kind: 'custom', spotId: 'custom-1', slot: 'morning', name: 'Bún riêu', address: '12 Hàng Bạc', ...over });

test('custom stops need a name and survive normalisation with clipped fields', () => {
  assert.equal(isValidStop(dish()), true);
  assert.equal(isValidStop(dish({ name: '   ' })), false);
  assert.equal(isValidStop(dish({ name: undefined })), false);
  const trip = normalizeTrip({ startDate: '2026-10-01', dayCount: 1, days: [{ stops: [
    dish({ name: '  ' + 'x'.repeat(200) + '  ', address: 'y'.repeat(300), startTime: 450, duration: 45, extra: '<b>' }),
    dish({ spotId: 'custom-2', name: '' }),
  ] }] });
  assert.equal(trip.days[0].stops.length, 1);
  const [stop] = trip.days[0].stops;
  assert.equal(stop.name.length, 80);
  assert.equal(stop.address.length, 120);
  assert.equal(stop.startTime, 450);
  assert.equal(stop.extra, undefined);
});

test('custom stops are scheduled at their time without needing coordinates', () => {
  const { items, summary } = run([
    { kind: 'place', spotId: 'lake', slot: 'morning' },
    dish({ slot: 'morning', startTime: 10 * 60, duration: 30 }),
  ]);
  assert.equal(items.length, 2);
  const custom = items[1];
  assert.equal(custom.name, 'Bún riêu');
  assert.equal(custom.noCoords, true);
  assert.equal(custom.km, 0);
  assert.equal(custom.start, 10 * 60);
  assert.equal(custom.end, 10 * 60 + 30);
  assert.equal(summary.stopCount, 2);
  assert.equal(summary.admissionTotal, 50000);
});

test('a custom stop without a time follows the previous stop', () => {
  const { items } = run([{ kind: 'place', spotId: 'lake', slot: 'morning' }, dish()]);
  assert.equal(items[1].start, items[0].end + 15);
});

test('slotForTime maps clock times to parts of the day', () => {
  assert.equal(slotForTime(6 * 60), 'morning');
  assert.equal(slotForTime(11 * 60 + 59), 'morning');
  assert.equal(slotForTime(12 * 60), 'afternoon');
  assert.equal(slotForTime(18 * 60), 'evening');
});

test('insertStopByTime puts a timed stop before the first later stop', () => {
  const stops = [
    { kind: 'place', spotId: 'lake', slot: 'morning' },
    { kind: 'place', spotId: 'citadel', slot: 'afternoon' },
  ];
  const { items } = run(stops);
  const early = insertStopByTime(stops, dish({ startTime: 7 * 60 }), items);
  assert.deepEqual(early.map((stop) => stop.spotId), ['custom-1', 'lake', 'citadel']);
  const middle = insertStopByTime(stops, dish({ slot: 'morning', startTime: 11 * 60 }), items);
  assert.deepEqual(middle.map((stop) => stop.spotId), ['lake', 'custom-1', 'citadel']);
  const late = insertStopByTime(stops, dish({ slot: 'evening', startTime: 20 * 60 }), items);
  assert.deepEqual(late.map((stop) => stop.spotId), ['lake', 'citadel', 'custom-1']);
  assert.equal(stops.length, 2);
});

test('maps text and calendar location skip a missing address', () => {
  assert.equal(placeText('Bún riêu', ''), 'Bún riêu, Hanoi, Vietnam');
  assert.equal(placeText('Bún riêu', '12 Hàng Bạc'), 'Bún riêu, 12 Hàng Bạc, Hanoi, Vietnam');
  const url = new URL(mapsDirections({ name: 'Start' }, 'Bún riêu', ''));
  assert.equal(url.searchParams.get('destination'), 'Bún riêu, Hanoi, Vietnam');
  const { items } = run([dish({ address: '' })]);
  const text = buildIcs([{ dateText: TUESDAY, items }], { now: new Date('2026-09-29T00:00:00Z') });
  assert.ok(text.includes('LOCATION:Bún riêu\\, Hanoi\\, Vietnam'));
});

test('custom stops are kept by share links, saved plans and custom tours', () => {
  const trip = normalizeTrip({ startDate: '2026-10-01', dayCount: 1, days: [{ stops: [dish({ startTime: 450 })] }] });
  assert.equal(decodeTrip(encodeTrip(trip)).days[0].stops[0].name, 'Bún riêu');
  const storage = fakeStorage();
  savePlan('With custom', trip, storage);
  assert.equal(readSavedPlans(storage)[0].trip.days[0].stops[0].address, '12 Hàng Bạc');
  addCustomTour('Mine', trip.days[0].stops, storage);
  const [tour] = readCustomTours(storage);
  assert.deepEqual(tour.stops, [{ kind: 'custom', spotId: 'custom-1', slot: 'morning', name: 'Bún riêu', address: '12 Hàng Bạc' }]);
});

test('pruneTrip keeps custom stops that are not in the catalogue', () => {
  const trip = normalizeTrip({ startDate: '2026-10-01', dayCount: 1, days: [{ stops: [dish(), { kind: 'place', spotId: 'gone', slot: 'morning' }] }] });
  assert.equal(pruneTrip(trip, new Set()), 1);
  assert.equal(trip.days[0].stops[0].kind, 'custom');
});

console.log(`${checks} schedule tests passed.`);
