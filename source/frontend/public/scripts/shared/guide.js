/**
 * TIỆN ÍCH DÙNG CHUNG: tải API, đọc/ghi lịch và Favorites, xử lý ngày, khoảng cách và URL Maps.
 * spot là món/địa điểm trong danh mục; venue là quán; stop là lựa chọn của khách trong một ngày.
 * localStorage chỉ lưu trên trình duyệt hiện tại, không gửi lịch vào SQLite.
 */
/** Dữ liệu chung cho ba trang. Chỉ Favorites và lịch được lưu trên máy này. */
const STORAGE_KEY = 'hanoi-local-trip-v2';
const FAVORITES_KEY = 'hanoi-local-favorite-dishes-v2';

export const ORIGINS = [
  { id: 'hoan-kiem', name: 'Hoan Kiem Lake', lat: 21.029, lng: 105.852 },
  { id: 'old-quarter', name: 'Old Quarter', lat: 21.035, lng: 105.849 },
  { id: 'temple', name: 'Temple of Literature', lat: 21.030, lng: 105.836 },
  { id: 'west-lake', name: 'West Lake', lat: 21.055, lng: 105.832 },
];

export const MAX_DAYS = 30;
export const MAX_STOPS_PER_DAY = 8;
export const MAX_CUSTOM_NAME = 80;
export const MAX_CUSTOM_ADDRESS = 120;

/**
 * Ba chủ đề tour. `pattern` chỉ mô tả kiểu điểm dừng (món hay địa điểm, buổi nào, ưu tiên nhóm nào);
 * điểm cụ thể do buildTourStops() chọn theo mốc xuất phát và các ngày khác trong chuyến đi.
 */
export const TOURS = [
  {
    id: 'old-quarter', title: 'Street food and sights',
    description: 'Local street food and well-known sights close to where you start.',
    image: '/assets/images/hero/old-quarter-street.webp',
    pattern: [
      { kind: 'food', slot: 'morning', prefer: ['Noodles'] },
      { kind: 'place', slot: 'morning', prefer: ['Neighbourhood', 'Landmark'] },
      { kind: 'food', slot: 'afternoon', prefer: ['Grilled', 'Street snack'] },
      { kind: 'place', slot: 'afternoon', prefer: ['Landmark'] },
      { kind: 'food', slot: 'evening', prefer: ['Coffee', 'Specialty'] },
    ],
  },
  {
    id: 'heritage', title: 'Heritage and museums',
    description: 'Historic sites and museums, with local meals nearby.',
    image: '/uploads/quoc-tu-giam.jpg',
    pattern: [
      { kind: 'food', slot: 'morning', prefer: ['Rice and sticky rice', 'Noodles'] },
      { kind: 'place', slot: 'morning', prefer: ['Heritage'] },
      { kind: 'food', slot: 'afternoon', prefer: ['Specialty', 'Grilled'] },
      { kind: 'place', slot: 'afternoon', prefer: ['Heritage', 'Museum'] },
    ],
  },
  {
    id: 'slow-day', title: 'A slow, relaxed day',
    description: 'Light bites, coffee and a lakeside or pagoda walk, kept close together.',
    image: '/uploads/hoan-kiem.jpg',
    pattern: [
      { kind: 'food', slot: 'morning', prefer: ['Coffee'] },
      { kind: 'place', slot: 'morning', prefer: ['Landmark', 'Neighbourhood'] },
      { kind: 'food', slot: 'afternoon', prefer: ['Rolls', 'Street snack'] },
      { kind: 'place', slot: 'afternoon', prefer: ['Pagoda', 'Landmark'] },
    ],
  },
];

// fetch gửi HTTP GET tới Express; await đợi phản hồi và tách mảng data khỏi JSON.
export async function loadSpots() {
  const response = await fetch('/api/spots');
  if (!response.ok) throw new Error('Could not load the Hanoi guide. Please reload.');
  const payload = await response.json();
  return payload.data ?? [];
}

// Dữ liệu localStorage là chuỗi JSON; nếu hỏng hoặc sai dạng thì trả danh sách rỗng.
export function readFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
  } catch { return []; }
}

// Set giúp mỗi món chỉ xuất hiện một lần; bấm lần nữa sẽ bỏ id khỏi tập yêu thích.
export function toggleFavorite(id) {
  const current = new Set(readFavorites());
  current.has(id) ? current.delete(id) : current.add(id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...current]));
  return current.has(id);
}

// Lấy ngày theo giờ máy người dùng; đặt giữa trưa trước khi cộng ngày để tránh sát ranh giới ngày.
function localDate(days = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Chỉ giữ các trường hợp lệ; giờ và thời lượng tự chỉnh phải nằm trong khoảng cho phép.
function cleanStop(stop) {
  const clean = { kind: stop.kind, spotId: stop.spotId, slot: stop.slot };
  if (stop.kind === 'custom') {
    clean.name = stop.name.trim().slice(0, MAX_CUSTOM_NAME);
    clean.address = typeof stop.address === 'string' ? stop.address.trim().slice(0, MAX_CUSTOM_ADDRESS) : '';
  }
  if (typeof stop.venueId === 'string') clean.venueId = stop.venueId;
  if (Number.isInteger(stop.startTime) && stop.startTime >= 0 && stop.startTime < 24 * 60) clean.startTime = stop.startTime;
  if (Number.isInteger(stop.duration) && stop.duration >= 15 && stop.duration <= 480) clean.duration = stop.duration;
  return clean;
}

/** Điểm dừng hợp lệ: món/địa điểm trong catalogue, hoặc điểm người dùng tự nhập (phải có tên). */
export function isValidStop(stop) {
  return ['food', 'place', 'custom'].includes(stop?.kind) &&
    ['morning', 'afternoon', 'evening'].includes(stop?.slot) &&
    typeof stop?.spotId === 'string' &&
    (stop.kind !== 'custom' || (typeof stop.name === 'string' && stop.name.trim().length > 0));
}

// Lịch mặc định có một ngày trống, xuất phát từ Hồ Hoàn Kiếm.
function defaultTrip() {
  return { startDate: localDate(), dayCount: 1, originId: 'hoan-kiem', days: [{ originId: null, stops: [] }] };
}

/** Biến dữ liệu bất kỳ (localStorage hoặc link chia sẻ) thành lịch hợp lệ; sai dạng thì dùng lịch trống. */
export function normalizeTrip(saved) {
  const fallback = defaultTrip();
  if (!saved || !Array.isArray(saved.days)) return fallback;
  const dayCount = Number.isInteger(saved.dayCount) && saved.dayCount >= 1 && saved.dayCount <= MAX_DAYS ? saved.dayCount : 1;
  return {
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(saved.startDate) ? saved.startDate : fallback.startDate,
    dayCount,
    originId: ORIGINS.some((item) => item.id === saved.originId) ? saved.originId : fallback.originId,
    days: Array.from({ length: Math.max(dayCount, Math.min(saved.days.length, MAX_DAYS)) }, (_, index) => ({
      originId: ORIGINS.some((item) => item.id === saved.days[index]?.originId) ? saved.days[index].originId : null,
      stops: Array.isArray(saved.days[index]?.stops)
        ? saved.days[index].stops.filter(isValidStop).slice(0, MAX_STOPS_PER_DAY).map(cleanStop)
        : [],
    })),
  };
}

// Đọc lịch cũ và chuẩn hóa; lần đầu truy cập hoặc JSON hỏng thì dùng lịch mặc định.
export function readTrip() {
  try { return normalizeTrip(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return defaultTrip(); }
}

/** Bỏ điểm dừng trỏ tới món/địa điểm không còn trong catalogue. Trả về số điểm đã bỏ. */
export function pruneTrip(trip, validIds) {
  let removed = 0;
  for (const day of trip.days) {
    const kept = day.stops.filter((stop) => stop.kind === 'custom' || validIds.has(stop.spotId));
    removed += day.stops.length - kept.length;
    day.stops = kept;
  }
  return removed;
}

/** Chỉ số ngày (bắt đầu từ 0) đang chứa điểm này, bỏ qua exceptDay và ngày ẩn; -1 nếu không có. */
export function dayUsingSpot(trip, spotId, exceptDay = -1) {
  return trip.days.findIndex((day, index) => index < trip.dayCount && index !== exceptDay &&
    day.stops.some((stop) => stop.spotId === spotId));
}

// localStorage chỉ nhận chuỗi nên cần JSON.stringify; lỗi ghi sẽ được phía gọi xử lý.
export function saveTrip(trip) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
}

const parseDate = (text) => { const [year, month, day] = text.split('-').map(Number); return Date.UTC(year, month - 1, day); };
const isoDate = (time) => new Date(time).toISOString().slice(0, 10);

/** YYYY-MM-DD cộng `count` ngày (tính theo UTC để không lệch vì giờ mùa hè). */
export function addDays(dateText, count) { return isoDate(parseDate(dateText) + count * 86400000); }

/** Số ngày từ `from` đến `to` (âm nếu `to` trước `from`). */
export function daysBetween(from, to) { return Math.round((parseDate(to) - parseDate(from)) / 86400000); }

/** Bảo đảm trip.days đủ dài cho `count` ngày. */
export function ensureDays(trip, count) {
  while (trip.days.length < count) trip.days.push({ originId: null, stops: [] });
}

// Đổi ngày bắt đầu + chỉ số ngày thành nhãn dễ đọc trên tab của trang Plan.
export function dateForDay(startDate, index) {
  const [year, month, day] = startDate.split('-').map(Number);
  const date = new Date(year, month - 1, day + index, 12);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(date);
}

// Ưu tiên mốc riêng của ngày, sau đó mốc chung của chuyến đi, cuối cùng là Hồ Hoàn Kiếm.
export function originFor(trip, index) {
  return ORIGINS.find((item) => item.id === (trip.days[index]?.originId || trip.originId)) ?? ORIGINS[0];
}

// Công thức Haversine: khoảng cách đường chim bay, không phải quãng đường đi bộ.
export function approxKm(a, b) {
  const toRad = (degree) => degree * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

// Sao chép mảng trước khi sort để không làm đổi thứ tự dữ liệu quán gốc.
export function sortedVenues(food, origin) {
  return [...(food.venues ?? [])].sort((a, b) => approxKm(origin, a) - approxKm(origin, b));
}

// Tạo URL tìm kiếm theo tên/địa chỉ; encodeURIComponent giữ ký tự tiếng Việt an toàn trong URL.
export function mapsSearch(name, address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}`;
}

/** "Tên, địa chỉ, Hanoi, Vietnam", bỏ phần trống (điểm tự nhập có thể không có địa chỉ). */
export const placeText = (name, address) => [name, address, 'Hanoi, Vietnam'].filter(Boolean).join(', ');

// Tạo link chỉ đường đi bộ; Google Maps tính đường đi thực tế sau khi người dùng mở link.
export function mapsDirections(origin, name, address) {
  const query = new URLSearchParams({
    api: '1', origin: placeText(origin.name, origin.address),
    destination: placeText(name, address),
    travelmode: 'walking',
  });
  return `https://www.google.com/maps/dir/?${query}`;
}

/**
 * Một tuyến Maps cho cả ngày: xuất phát từ `origin`, đi qua các điểm theo thứ tự.
 * `stops` là [{ name, address }]; Maps cho tối đa khoảng 9 điểm trung gian.
 */
export function mapsRoute(origin, stops) {
  if (!stops.length) return '';
  const text = (item) => placeText(item.name, item.address);
  const query = new URLSearchParams({
    api: '1',
    origin: placeText(origin.name, origin.address),
    destination: text(stops.at(-1)),
  });
  if (stops.length > 1) query.set('waypoints', stops.slice(0, -1).map(text).join('|'));
  return `https://www.google.com/maps/dir/?${query}`;
}

// Món ăn dùng tọa độ quán đã chọn; địa điểm thiếu tọa độ thì dùng mốc Hồ Hoàn Kiếm.
export function spotPoint(spot, venue) {
  if (venue) return venue;
  const { lat, lng } = Number.isFinite(spot.lat) && Number.isFinite(spot.lng) ? spot : ORIGINS[0];
  return { lat, lng, name: spot.name };
}
