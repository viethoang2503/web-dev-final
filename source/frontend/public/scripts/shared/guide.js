/** Dữ liệu chung cho ba trang. Chỉ Favorites và lịch được lưu trên máy này. */
const STORAGE_KEY = 'hanoi-local-trip-v2';
const FAVORITES_KEY = 'hanoi-local-favorite-dishes-v2';

export const ORIGINS = [
  { id: 'hoan-kiem', name: 'Hoan Kiem Lake', lat: 21.029, lng: 105.852 },
  { id: 'old-quarter', name: 'Old Quarter', lat: 21.035, lng: 105.849 },
  { id: 'temple', name: 'Temple of Literature', lat: 21.030, lng: 105.836 },
  { id: 'west-lake', name: 'West Lake', lat: 21.055, lng: 105.832 },
];

// Tọa độ gần đúng để sắp xếp gợi ý, không dùng làm đường đi thực tế.
export const PLACE_POINTS = {
  'place-hoan-kiem-lake': [21.029, 105.852],
  'place-old-quarter': [21.035, 105.849],
  'place-temple-of-literature': [21.030, 105.836],
  'place-thang-long-citadel': [21.036, 105.840],
  'place-ho-chi-minh-complex': [21.037, 105.835],
  'place-museum-of-ethnology': [21.040, 105.799],
  'place-hoa-lo-prison': [21.026, 105.846],
  'place-tran-quoc-pagoda': [21.048, 105.837],
  'place-long-bien-bridge': [21.041, 105.860],
  'place-womens-museum': [21.023, 105.850],
};

export const TOURS = [
  {
    id: 'old-quarter', title: 'Old Quarter, all day',
    description: 'A first look at the streets, lake and food around Hoan Kiem.',
    image: '/assets/images/hero/old-quarter-street.webp',
    stops: [
      { kind: 'food', spotId: 'food-pho-bo', slot: 'morning' },
      { kind: 'place', spotId: 'place-old-quarter', slot: 'morning' },
      { kind: 'food', spotId: 'food-bun-cha', slot: 'afternoon' },
      { kind: 'place', spotId: 'place-hoan-kiem-lake', slot: 'afternoon' },
      { kind: 'food', spotId: 'food-ca-phe-trung', slot: 'evening' },
    ],
  },
  {
    id: 'heritage', title: 'Hanoi heritage',
    description: 'Quiet courtyards and historic streets with local meals.',
    image: '/uploads/quoc-tu-giam.jpg',
    stops: [
      { kind: 'food', spotId: 'food-banh-cuon', slot: 'morning' },
      { kind: 'place', spotId: 'place-temple-of-literature', slot: 'morning' },
      { kind: 'food', spotId: 'food-cha-ca', slot: 'afternoon' },
      { kind: 'place', spotId: 'place-thang-long-citadel', slot: 'afternoon' },
    ],
  },
  {
    id: 'slow-day', title: 'Take it slowly',
    description: 'Coffee, water and a relaxed walk towards Truc Bach.',
    image: '/uploads/hoan-kiem.jpg',
    stops: [
      { kind: 'food', spotId: 'food-ca-phe-trung', slot: 'morning' },
      { kind: 'place', spotId: 'place-hoan-kiem-lake', slot: 'morning' },
      { kind: 'food', spotId: 'food-pho-cuon', slot: 'afternoon' },
      { kind: 'place', spotId: 'place-tran-quoc-pagoda', slot: 'afternoon' },
    ],
  },
];

export async function loadSpots() {
  const response = await fetch('/api/spots');
  if (!response.ok) throw new Error('Could not load the Hanoi guide. Please reload.');
  const payload = await response.json();
  return payload.data ?? [];
}

export function readFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
  } catch { return []; }
}

export function toggleFavorite(id) {
  const current = new Set(readFavorites());
  current.has(id) ? current.delete(id) : current.add(id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...current]));
  return current.has(id);
}

function localDate(days = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function readTrip() {
  const fallback = { startDate: localDate(), dayCount: 1, originId: 'hoan-kiem', days: Array.from({ length: 3 }, () => ({ originId: null, stops: [] })) };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.days)) return fallback;
    return {
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(saved.startDate) ? saved.startDate : fallback.startDate,
      dayCount: [1, 2, 3].includes(saved.dayCount) ? saved.dayCount : 1,
      originId: ORIGINS.some((item) => item.id === saved.originId) ? saved.originId : fallback.originId,
      days: Array.from({ length: 3 }, (_, index) => ({
        originId: ORIGINS.some((item) => item.id === saved.days[index]?.originId) ? saved.days[index].originId : null,
        stops: Array.isArray(saved.days[index]?.stops)
          ? saved.days[index].stops.filter((stop) =>
            ['food', 'place'].includes(stop?.kind) &&
            ['morning', 'afternoon', 'evening'].includes(stop?.slot) &&
            typeof stop?.spotId === 'string'
          ).slice(0, 6)
          : [],
      })),
    };
  } catch { return fallback; }
}

export function saveTrip(trip) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
}

export function dateForDay(startDate, index) {
  const [year, month, day] = startDate.split('-').map(Number);
  const date = new Date(year, month - 1, day + index, 12);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(date);
}

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

export function sortedVenues(food, origin) {
  return [...(food.venues ?? [])].sort((a, b) => approxKm(origin, a) - approxKm(origin, b));
}

export function mapsSearch(name, address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}`;
}

export function mapsDirections(origin, name, address) {
  const originText = origin.address
    ? `${origin.name}, ${origin.address}, Hanoi, Vietnam`
    : `${origin.name}, Hanoi, Vietnam`;
  const query = new URLSearchParams({
    api: '1', origin: originText,
    destination: `${name}, ${address}, Hanoi, Vietnam`,
    travelmode: 'walking',
  });
  return `https://www.google.com/maps/dir/?${query}`;
}

export function spotPoint(spot, venue) {
  if (venue) return venue;
  const [lat, lng] = PLACE_POINTS[spot.id] ?? [21.029, 105.852];
  return { lat, lng, name: spot.name };
}
