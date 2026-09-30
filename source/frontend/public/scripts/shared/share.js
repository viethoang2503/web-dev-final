/**
 * CHIA SẺ KHÔNG CẦN DATABASE: JSON → byte UTF-8 → base64url → phần #plan= của URL.
 * Base64url chỉ là cách biểu diễn dữ liệu, không phải mã hóa bảo mật; người có link đọc được lịch.
 * Khi mở link, ứng dụng giải mã và chuẩn hóa trước khi áp dụng vào lịch hiện tại.
 */
/** Chia sẻ lịch qua link: lịch được mã hóa base64url trong phần #plan= của URL, không qua server. */
import { normalizeTrip } from './guide.js';

const PARAM = 'plan';
const MAX_ENCODED_LENGTH = 40000;

// Chuyển tiếng Việt thành UTF-8 trước khi btoa; thay ký tự để chuỗi phù hợp với URL.
function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

// Khôi phục ký tự và dấu đệm base64, giải mã byte rồi đọc lại chuỗi UTF-8.
function fromBase64Url(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
}

// Chỉ đưa các ngày đang hiển thị vào link; không mang theo những ngày tạm ẩn khi giảm số ngày.
export function encodeTrip(trip) {
  const compact = {
    startDate: trip.startDate,
    dayCount: trip.dayCount,
    originId: trip.originId,
    days: trip.days.slice(0, trip.dayCount),
  };
  return toBase64Url(JSON.stringify(compact));
}

/** Trả về lịch đã được làm sạch, hoặc null nếu chuỗi hỏng hay quá dài. */
export function decodeTrip(encoded) {
  if (!encoded || encoded.length > MAX_ENCODED_LENGTH || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const trip = normalizeTrip(JSON.parse(fromBase64Url(encoded)));
    return trip.days.some((day) => day.stops.length) ? trip : null;
  } catch { return null; }
}

// Bỏ query cũ như ?tour=... để khi mở link chỉ áp dụng lịch đã chia sẻ.
export function shareUrl(trip, base = location.href) {
  const url = new URL(base);
  url.search = '';
  url.hash = `${PARAM}=${encodeTrip(trip)}`;
  return url.toString();
}

/** Đọc lịch chia sẻ từ hash của URL hiện tại (không đổi gì trong trình duyệt). */
export function sharedTripFromHash(hash = location.hash) {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get(PARAM);
  return value === null ? { present: false, trip: null } : { present: true, trip: decodeTrip(value) };
}
