/**
 * BỘ TÍNH LỊCH: nhận danh sách điểm và trả { items, summary } để trang Plan hiển thị.
 * Giờ được biểu diễn bằng số phút từ 00:00: ví dụ 08:30 = 510, giúp cộng thời lượng dễ dàng.
 * Tách tính toán khỏi giao diện để có thể kiểm thử bằng Node mà không mở trình duyệt.
 */
/**
 * Xếp giờ cho một ngày. Hàm thuần, không đụng DOM hay localStorage nên test được
 * bằng Node. Mọi khoảng cách chỉ là ước tính đường chim bay; Maps mới chỉ đường thật.
 */
import { MAX_STOPS_PER_DAY, approxKm } from './guide.js';

export { MAX_STOPS_PER_DAY };

export const SLOT_ORDER = ['morning', 'afternoon', 'evening'];
export const SLOT_START = { morning: 8 * 60, afternoon: 12 * 60, evening: 18 * 60 };
export const SLOT_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
export const DAY_END = 22 * 60;
const FOOD_MINUTES = 50;
const DEFAULT_VISIT_MINUTES = 60;
const ROAD_FACTOR = 1.3; // đường thật dài hơn đường chim bay
const WALK_LIMIT_KM = 1.5;
const LATE_WARNING_MINUTES = 45; // điểm đầu buổi trễ ít hơn mức này là bình thường (đi lại)

export const MIN_DURATION = 15;
export const MAX_DURATION = 480;

/** Thứ tự hiển thị: theo buổi, cùng buổi thì theo thứ tự thêm vào. */
export function orderStops(stops) {
  return stops
    .map((stop, originalIndex) => ({ stop, originalIndex }))
    .sort((a, b) => SLOT_ORDER.indexOf(a.stop.slot) - SLOT_ORDER.indexOf(b.stop.slot) || a.originalIndex - b.originalIndex);
}

/**
 * Dời một điểm lên (-1) hoặc xuống (+1) một vị trí trong thứ tự hiển thị và trả về
 * mảng mới (mảng cũ không đổi). Khi vượt ranh giới buổi, điểm đó chuyển sang buổi
 * của điểm bị hoán đổi.
 */
export function moveStop(stops, originalIndex, direction) {
  const ordered = orderStops(stops);
  const from = ordered.findIndex((entry) => entry.originalIndex === originalIndex);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ordered.length) return stops;
  const list = ordered.map((entry) => ({ ...entry.stop }));
  [list[from], list[to]] = [list[to], list[from]];
  list[to].slot = ordered[to].stop.slot;
  return list;
}

const CUSTOM_TRAVEL_MINUTES = 15; // điểm tự nhập không có tọa độ nên chỉ ước lượng thời gian đi lại

/** Buổi hợp với một giờ trong ngày: buổi muộn nhất có giờ bắt đầu không sau giờ đó. */
export function slotForTime(minutes) {
  return SLOT_ORDER.reduce((found, slot) => (SLOT_START[slot] <= minutes ? slot : found), SLOT_ORDER[0]);
}

/** Điểm tự nhập trông như một "spot" tối giản để dùng chung logic xếp lịch. */
const customSpot = (stop) => ({ id: stop.spotId, kind: 'custom', name: stop.name, address: stop.address ?? '', category: 'Your own stop', district: '', openingHours: '' });

export const defaultDuration = (spot) => (spot.kind === 'food' ? FOOD_MINUTES : (spot.durationMinutes ?? DEFAULT_VISIT_MINUTES));

export function formatTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Đi bộ cho quãng ngắn, xe máy/taxi cho quãng dài; làm tròn lên 5 phút, tối thiểu 10. */
export function travelMinutes(km) {
  const road = km * ROAD_FACTOR;
  const minutes = road <= WALK_LIMIT_KM ? (road / 5) * 60 : 8 + (road / 18) * 60;
  return Math.max(10, Math.ceil(minutes / 5) * 5);
}

/**
 * Cảnh báo giờ mở cửa cho khoảng [start, finish] (phút trong ngày) vào ngày dateText.
 * Đọc được các mẫu: "08:00 - 17:00", nhiều khoảng cách nhau dấu phẩy, "closed Monday",
 * "closed Monday and Friday afternoon", "open all day", khoảng qua nửa đêm.
 */
export function openingWarning(hours, dateText, start, finish) {
  if (!hours) return '';
  const weekday = new Date(`${dateText}T12:00:00`).getDay();
  const closed = /closed([^,]*)/i.exec(hours)?.[1] ?? '';
  if (/monday/i.test(closed) && weekday === 1) return 'May be closed on Monday. Check before visiting.';
  if (/friday afternoon/i.test(closed) && weekday === 5 && finish > 12 * 60) return 'May be closed on Friday afternoon.';
  const ranges = [...hours.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)];
  if (!ranges.length || /open all day/i.test(hours)) return '';
  const fits = ranges.some(([, h1, m1, h2, m2]) => {
    const open = Number(h1) * 60 + Number(m1);
    let close = Number(h2) * 60 + Number(m2);
    if (close <= open) close += 24 * 60;
    return start >= open && finish <= close;
  });
  return fits ? '' : `Outside listed hours (${hours}). Check before visiting.`;
}

/**
 * @param {object} input
 * @param {Array<{kind: string, slot: string, spotId: string, venueId?: string}>} input.stops
 * @param {{lat: number, lng: number, district?: string}} input.origin
 * @param {string} input.dateText YYYY-MM-DD
 * @param {(id: string) => object | undefined} input.getSpot
 * @param {(stop: object, spot: object) => object | null} input.getVenue quán được chọn cho món ăn
 * @param {(spot: object, venue: object | null) => {lat: number, lng: number}} input.getPoint
 */
export function scheduleDay({ stops, origin, dateText, getSpot, getVenue, getPoint }) {
  const ordered = orderStops(stops);

  // cursor là giờ rời điểm trước; previous là vị trí trước đó để tính khoảng cách.
  let cursor = null;
  let previous = origin;
  const items = [];
  for (const { stop, originalIndex } of ordered) {
    const isCustom = stop.kind === 'custom';
    const spot = isCustom ? customSpot(stop) : getSpot(stop.spotId);
    if (!spot) continue;
    const venue = stop.kind === 'food' ? getVenue(stop, spot) : null;
    const point = isCustom ? { lat: previous.lat, lng: previous.lng } : getPoint(spot, venue);
    const km = isCustom ? 0 : approxKm(previous, point);
    // Điểm đầu bắt đầu ngay ở mốc buổi, chưa cộng thời gian đi từ nơi xuất phát; các điểm sau có thời gian đệm.
    const travel = cursor === null ? 0 : (isCustom ? CUSTOM_TRAVEL_MINUTES : travelMinutes(km));
    const slotStart = SLOT_START[stop.slot];
    const startsSlot = items.at(-1)?.stop.slot !== stop.slot; // chỉ điểm đầu buổi mới bị coi là "trễ" khi buổi trước kéo dài
    const earliest = cursor === null ? 0 : cursor + travel;
    const pinned = Number.isInteger(stop.startTime);
    // Nếu khách ghim giờ thì giữ giờ đó; nếu tự động thì chọn giờ muộn hơn giữa đầu buổi và giờ có thể đến.
    const start = pinned ? stop.startTime : Math.max(slotStart, earliest);
    const duration = Number.isInteger(stop.duration) ? stop.duration : defaultDuration(spot);
    const end = start + duration;
    // Cảnh báo chỉ cung cấp thông tin, không tự bỏ điểm hay sửa giờ đã ghim của khách.
    const warnings = [];
    const hoursWarning = openingWarning(spot.openingHours, dateText, start, end);
    if (hoursWarning) warnings.push(hoursWarning);
    if (pinned && cursor !== null && start < earliest) {
      warnings.push(`Not enough time to reach this stop from the previous one. Earliest arrival is about ${formatTime(earliest)}.`);
    }
    if (!pinned && startsSlot && start - slotStart >= LATE_WARNING_MINUTES) {
      warnings.push(`Runs late: starts at ${formatTime(start)} instead of ${formatTime(slotStart)} because earlier stops take longer.`);
    }
    if (end > DAY_END) warnings.push(`Ends at ${formatTime(end)}, after ${formatTime(DAY_END)}. Consider removing a stop.`);

    const name = venue?.name ?? spot.name;
    const address = venue?.address ?? spot.address;
    items.push({
      stop, originalIndex, spot, venue, point, name, address, previous, km,
      travelMinutes: travel, start, end, duration, warnings, pinned, noCoords: isCustom,
      customDuration: Number.isInteger(stop.duration),
    });
    cursor = end;
    previous = { ...point, name, address, district: venue?.district ?? spot.district };
  }

  const places = items.filter((item) => item.spot.kind === 'place');
  // Tổng hợp cho ô tóm tắt; tiền chỉ cộng vé tham quan, chưa có tiền ăn hoặc vận chuyển.
  const summary = {
    stopCount: items.length,
    startMinutes: items.length ? Math.min(...items.map((item) => item.start)) : null,
    endMinutes: items.length ? Math.max(...items.map((item) => item.end)) : null,
    totalKm: items.reduce((sum, item) => sum + item.km, 0),
    travelMinutes: items.reduce((sum, item) => sum + item.travelMinutes, 0),
    admissionTotal: places.reduce((sum, item) => sum + (item.spot.admission ?? 0), 0),
    warningCount: items.reduce((sum, item) => sum + item.warnings.length, 0),
  };
  return { items, summary };
}

/**
 * Sắp lại thứ tự trong từng buổi theo kiểu "đi tới điểm gần nhất" (nearest-neighbor),
 * bắt đầu từ `origin` rồi nối tiếp từ điểm cuối của buổi trước. Không đổi buổi của điểm nào.
 * Điểm đã ghim giờ giữ nguyên vị trí. Trả về mảng mới theo thứ tự hiển thị.
 * Đây là heuristic, không đảm bảo quãng đường ngắn nhất.
 */
export function optimizeOrder(stops, { origin, getSpot, getVenue, getPoint }) {
  const ordered = orderStops(stops).map((entry) => ({ ...entry.stop }));
  const pointOf = (stop) => {
    const spot = getSpot(stop.spotId);
    return spot ? getPoint(spot, stop.kind === 'food' ? getVenue(stop, spot) : null) : null;
  };
  let previous = origin;
  const result = [];
  for (const slot of SLOT_ORDER) {
    const group = ordered.filter((stop) => stop.slot === slot);
    // Chỉ đổi vị trí các điểm chưa ghim giờ và có tọa độ; giữ vị trí điểm ghim/không có tọa độ.
    const free = group.filter((stop) => !Number.isInteger(stop.startTime) && pointOf(stop));
    const remaining = [...free];
    const sorted = [];
    let from = previous;
    // Mỗi vòng chọn ứng viên gần nhất, bỏ khỏi danh sách còn lại rồi dùng nó làm điểm xuất phát tiếp theo.
    while (remaining.length) {
      let best = 0;
      for (let index = 1; index < remaining.length; index += 1) {
        if (approxKm(from, pointOf(remaining[index])) < approxKm(from, pointOf(remaining[best]))) best = index;
      }
      const [next] = remaining.splice(best, 1);
      sorted.push(next);
      from = pointOf(next);
    }
    let cursor = 0;
    const merged = group.map((stop) => (free.includes(stop) ? sorted[cursor++] : stop));
    result.push(...merged);
    const last = merged.at(-1);
    if (last && pointOf(last)) previous = pointOf(last);
  }
  return result;
}

/**
 * Gợi ý tối đa `limit` món/địa điểm gần điểm cuối của ngày (hoặc gần mốc xuất phát khi
 * ngày còn trống) mà vẫn mở cửa vào giờ dự kiến và chưa có trong chính ngày này.
 *
 * @param {object} input
 * @param {Array<object>} input.items kết quả của scheduleDay().items
 * @param {Array<object>} input.spots toàn bộ catalogue
 * @param {Set<string>} input.usedIds spotId đã nằm trong ngày này (bị loại)
 * @param {Set<string>} [input.elsewhereIds] spotId đã nằm ở ngày khác (vẫn được gợi ý nhưng xếp sau)
 */
export function suggestNearby({ items, origin, spots, usedIds, elsewhereIds = new Set(), dateText, getPoint, limit = 3 }) {
  if (items.length >= MAX_STOPS_PER_DAY) return [];
  const last = items.at(-1);
  const from = last ? last.point : origin;
  const lastSlotIndex = last ? SLOT_ORDER.indexOf(last.stop.slot) : 0;
  const suggestions = [];
  for (const spot of spots) {
    if (usedIds.has(spot.id)) continue;
    const venue = spot.kind === 'food'
      ? [...(spot.venues ?? [])].sort((a, b) => approxKm(from, a) - approxKm(from, b))[0] ?? null
      : null;
    if (spot.kind === 'food' && !venue) continue;
    const point = getPoint(spot, venue);
    const km = approxKm(from, point);
    // Ước tính nếu nối thêm điểm này vào cuối ngày thì đến sớm nhất lúc nào.
    const earliest = last ? last.end + travelMinutes(km) : SLOT_START.morning;
    const byTime = SLOT_ORDER.reduce((found, slot, index) => (SLOT_START[slot] <= earliest ? index : found), 0);
    const slot = SLOT_ORDER[Math.max(byTime, lastSlotIndex)];
    const start = Math.max(SLOT_START[slot], earliest);
    const end = start + defaultDuration(spot);
    // Loại gợi ý kết thúc quá muộn hoặc không vừa giờ mở cửa tham khảo; không kiểm tra giờ thực tế của từng quán.
    if (end > DAY_END || openingWarning(spot.openingHours, dateText, start, end)) continue;
    suggestions.push({ spot, venue, km, slot, start, end, elsewhere: elsewhereIds.has(spot.id) });
  }
  // Điểm chưa nằm ở ngày nào đứng trước; điểm đã có ở ngày khác chỉ để lấp chỗ trống.
  return suggestions.sort((a, b) => Number(a.elsewhere) - Number(b.elsewhere) || a.km - b.km).slice(0, limit);
}

/**
 * Chèn `stop` (đã có startTime) vào đúng vị trí theo giờ: trước điểm đầu tiên bắt đầu muộn hơn nó.
 * `items` là kết quả scheduleDay() của danh sách hiện tại. Trả về mảng mới theo thứ tự hiển thị.
 */
export function insertStopByTime(stops, stop, items) {
  const startByIndex = new Map(items.map((item) => [item.originalIndex, item.start]));
  const ordered = orderStops(stops);
  const list = ordered.map((entry) => ({ ...entry.stop }));
  const position = ordered.findIndex((entry) => (startByIndex.get(entry.originalIndex) ?? -1) > stop.startTime);
  list.splice(position === -1 ? list.length : position, 0, stop);
  return list;
}
