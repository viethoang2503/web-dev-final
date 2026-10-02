/**
 * THƯ VIỆN CÁ NHÂN: lưu tối đa 10 lịch có tên và 10 tour tự tạo bằng hai khóa localStorage.
 * Lịch có tên giữ toàn bộ chuyến đi; tour chỉ giữ các điểm của một ngày để dùng lại với quán/giờ tính lại.
 * Tham số storage có thể thay bằng đối tượng giả khi chạy unit test.
 */
/**
 * Kho cá nhân trong localStorage: các lịch đã lưu tên và tour tự tạo.
 * Lịch đang chỉnh vẫn nằm ở khóa riêng trong guide.js, nên các trang khác không bị ảnh hưởng.
 */
import { MAX_STOPS_PER_DAY, isValidStop, normalizeTrip } from './guide.js';

const PLANS_KEY = 'hanoi-local-saved-plans-v1';
const TOURS_KEY = 'hanoi-local-custom-tours-v1';
export const MAX_SAVED_PLANS = 10;
export const MAX_CUSTOM_TOURS = 10;
export const MAX_NAME_LENGTH = 40;

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// Đọc mảng JSON từ kho được truyền vào; dữ liệu hỏng trả mảng rỗng để trang vẫn hoạt động.
function readList(key, storage) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

const cleanName = (name, fallback) => String(name ?? '').trim().slice(0, MAX_NAME_LENGTH) || fallback;

/** Chỉ giữ loại điểm, id, buổi (và tên/địa chỉ với điểm tự nhập); quán và giờ được tính lại khi dùng. */
function tourStop(stop) {
  const base = { kind: stop.kind, spotId: stop.spotId, slot: stop.slot };
  return stop.kind === 'custom' ? { ...base, name: stop.name.trim().slice(0, 80), address: String(stop.address ?? '').trim().slice(0, 120) } : base;
}

// Kiểm tra các bản lưu, chuẩn hóa lịch và giới hạn số bản trước khi đưa ra giao diện.
export function readSavedPlans(storage = localStorage) {
  return readList(PLANS_KEY, storage)
    .filter((item) => typeof item?.id === 'string' && typeof item?.name === 'string')
    .map((item) => ({ id: item.id, name: item.name.slice(0, MAX_NAME_LENGTH), savedAt: Number(item.savedAt) || 0, trip: normalizeTrip(item.trip) }))
    .slice(0, MAX_SAVED_PLANS);
}

/** Lưu bản sao của lịch; trùng tên (không phân biệt hoa thường) thì ghi đè bản cũ. */
export function savePlan(name, trip, storage = localStorage, now = Date.now(), maxPlans = MAX_SAVED_PLANS) {
  const plans = readSavedPlans(storage);
  const finalName = cleanName(name, `Plan ${trip.startDate}`);
  const existing = plans.find((item) => item.name.toLowerCase() === finalName.toLowerCase());
  if (!existing && plans.length >= maxPlans) return { error: `You can keep up to ${maxPlans} saved ${maxPlans === 1 ? 'plan' : 'plans'}. Delete one first.`, plans };
  const entry = { id: existing?.id ?? newId(), name: finalName, savedAt: now, trip: normalizeTrip(JSON.parse(JSON.stringify(trip))) };
  const next = [entry, ...plans.filter((item) => item.id !== entry.id)];
  storage.setItem(PLANS_KEY, JSON.stringify(next));
  return { plans: next, replaced: Boolean(existing) };
}

// Lọc bỏ bản có id tương ứng rồi ghi lại danh sách; không thay lịch đang chỉnh.
export function deletePlan(id, storage = localStorage) {
  const next = readSavedPlans(storage).filter((item) => item.id !== id);
  storage.setItem(PLANS_KEY, JSON.stringify(next));
  return next;
}

/** Tour tự tạo chỉ giữ loại điểm, id và buổi; quán và giờ được tính lại khi dùng. */
export function readCustomTours(storage = localStorage) {
  return readList(TOURS_KEY, storage)
    .filter((item) => typeof item?.id === 'string' && typeof item?.title === 'string' && Array.isArray(item.stops))
    .map((item) => ({
      id: item.id,
      title: item.title.slice(0, MAX_NAME_LENGTH),
      custom: true,
      stops: item.stops.filter(isValidStop).slice(0, MAX_STOPS_PER_DAY).map(tourStop),
    }))
    .filter((tour) => tour.stops.length)
    .slice(0, MAX_CUSTOM_TOURS);
}

// Kiểm tra số điểm và giới hạn tour, tạo id mới rồi lưu mẫu điểm để dùng ở ngày khác.
export function addCustomTour(title, stops, storage = localStorage) {
  const tours = readCustomTours(storage);
  if (!stops.length) return { error: 'Add at least one stop before saving a tour.', tours };
  if (tours.length >= MAX_CUSTOM_TOURS) return { error: `You can keep up to ${MAX_CUSTOM_TOURS} tours. Delete one first.`, tours };
  const tour = {
    id: newId(),
    title: cleanName(title, `My tour ${tours.length + 1}`),
    stops: stops.map(tourStop),
  };
  const next = [...tours, tour];
  storage.setItem(TOURS_KEY, JSON.stringify(next));
  return { tours: readCustomTours(storage) };
}

// Xóa mẫu trong thư viện; những điểm đã áp dụng vào chuyến đi vẫn là dữ liệu riêng.
export function deleteCustomTour(id, storage = localStorage) {
  const next = readCustomTours(storage).filter((item) => item.id !== id);
  storage.setItem(TOURS_KEY, JSON.stringify(next));
  return next;
}
