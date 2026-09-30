/**
 * DỰNG TOUR THEO QUY TẮC: mỗi bước trong pattern yêu cầu loại điểm, buổi và nhóm ưu tiên.
 * Chấm điểm ứng viên theo khoảng cách + điểm phạt lệch chủ đề + điểm phạt đã dùng.
 * Điểm số càng thấp càng được ưu tiên; đây là thuật toán gợi ý theo quy tắc, không phải AI.
 */
/**
 * Dựng điểm dừng cho một tour quanh mốc xuất phát: mỗi bước của `pattern` chọn điểm gần điểm trước đó
 * (khoảng cách là chính, nhóm hợp chủ đề chỉ được ưu tiên nhẹ), và tránh các điểm đã dùng ở ngày khác nên mỗi ngày một khác.
 */
import { approxKm } from './guide.js';

const OFF_THEME_KM = 1; // chủ đề chỉ ưu tiên nhẹ: cộng thêm 1 vào điểm số nếu ứng viên nằm ngoài nhóm ưu tiên
const USED_PENALTY_KM = 100; // điểm đã dùng ở ngày khác chỉ được chọn khi hết điểm mới

function nearestVenue(food, from) {
  return [...(food.venues ?? [])].sort((a, b) => approxKm(from, a) - approxKm(from, b))[0] ?? null;
}

/**
 * @param {{ pattern: Array<{kind: string, slot: string, prefer?: string[]}> }} tour
 * @param {object} input
 * @param {{lat: number, lng: number}} input.origin
 * @param {Array<object>} input.spots
 * @param {Set<string>} [input.usedIds] điểm đã nằm ở ngày khác
 * @param {(spot: object, venue: object | null) => {lat: number, lng: number}} input.getPoint
 * @returns {Array<{kind: string, spotId: string, slot: string, venueId?: string}>}
 */
export function buildTourStops(tour, { origin, spots, usedIds = new Set(), getPoint }) {
  // Lượt đầu tránh điểm ở ngày khác; nếu không đủ bước thì dựng lại với quyền tái dùng và điểm phạt cao.
  const build = (allowUsed) => {
    const picked = new Set();
    const stops = [];
    let from = origin;
    for (const step of tour.pattern) {
      const candidates = spots
        .filter((spot) => spot.kind === step.kind && !picked.has(spot.id) && (allowUsed || !usedIds.has(spot.id)))
        .map((spot) => {
          const venue = spot.kind === 'food' ? nearestVenue(spot, from) : null;
          if (spot.kind === 'food' && !venue) return null;
          const point = getPoint(spot, venue);
          // So sánh cùng một thang điểm: khoảng cách ngắn là chính, chủ đề và mức trùng lặp điều chỉnh thứ tự.
          const score = approxKm(from, point)
            + (step.prefer?.includes(spot.category) ? 0 : OFF_THEME_KM)
            + (usedIds.has(spot.id) ? USED_PENALTY_KM : 0);
          return { spot, venue, point, score };
        })
        .filter(Boolean)
        .sort((a, b) => a.score - b.score);
      const best = candidates[0];
      if (!best) continue;
      // Đánh dấu để không chọn trùng trong cùng tour; cập nhật from để bước sau gần bước vừa chọn.
      picked.add(best.spot.id);
      stops.push({ kind: step.kind, spotId: best.spot.id, slot: step.slot, ...(best.venue ? { venueId: best.venue.id } : {}) });
      from = best.point;
    }
    return stops;
  };
  const fresh = build(false);
  // Hết điểm mới thì tái dùng điểm cũ cho các bước còn thiếu (điểm mới vẫn được ưu tiên trước).
  return fresh.length === tour.pattern.length ? fresh : build(true);
}
