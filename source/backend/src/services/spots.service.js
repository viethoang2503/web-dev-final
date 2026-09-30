/**
 * TẦNG ĐỌC DỮ LIỆU: lấy món ăn/địa điểm từ bảng spots và chuyển thành đối tượng cho frontend.
 * Thông tin quán được ghép thêm từ FOOD_VENUES theo id món; quán không nằm trong bảng riêng ở SQLite.
 */
/** Đọc bảng spots; đổi tên cột SQL thành JSON mà frontend sử dụng. */
import { getDb } from '../database/connection.js';
import { FOOD_VENUES } from '../data/food-venues.js';

export const SPOT_KINDS = ['food', 'place'];

const SELECT_COLUMNS = `
  id, kind, name, short_description, description, category, district,
  price_level, admission, rating, duration_minutes, image_url, lat, lng,
  address, opening_hours, local_tip, featured
`;

/** Chuyển hàng SQL thành JSON; một số trường tùy chọn vẫn giữ giá trị null. */
// Đổi snake_case của SQL sang camelCase cho JavaScript; trường null có thể vẫn được giữ trong JSON.
function toSpot(row) {
  const spot = {
    id: row.id,
    kind: row.kind,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    category: row.category,
    district: row.district,
    rating: row.rating,
    image: row.image_url,
    address: row.address,
    openingHours: row.opening_hours,
    localTip: row.local_tip,
    featured: row.featured === 1,
  };

  // Tách trường theo loại: món có mức giá/quán; địa điểm có vé/thời lượng/tọa độ.
  if (row.kind === 'food') {
    spot.priceLevel = row.price_level;
    // Một món có nhiều quán để người dùng tự chọn và so khoảng cách ước tính.
    spot.venues = FOOD_VENUES[row.id] ?? [];
  } else {
    spot.admission = row.admission;
    spot.isFree = row.admission === 0;
    spot.durationMinutes = row.duration_minutes;
    spot.lat = row.lat;
    spot.lng = row.lng;
  }

  return spot;
}

/**
 * Lấy danh sách: mục nổi bật trước, sau đó đánh giá giảm dần, cuối cùng tên tăng dần.
 * Frontend nhận thứ tự gợi ý này làm thứ tự ban đầu.
 *
 * @param {{ kind?: string }} [filters]
 */
export function listSpots({ kind } = {}) {
  const db = getDb();
  // Chỉ ghép đoạn SQL do chương trình định nghĩa; giá trị kind truyền qua dấu ? để tách dữ liệu khỏi lệnh SQL.
  const where = kind ? 'WHERE kind = ?' : '';
  const params = kind ? [kind] : [];

  const rows = db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
         FROM spots
         ${where}
     ORDER BY featured DESC, rating DESC, name ASC`
    )
    .all(...params);

  return rows.map(toSpot);
}

/** Tìm một mục theo id; không thấy thì trả undefined để router báo 404. */
export function getSpotById(id) {
  const db = getDb();
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM spots WHERE id = ?`).get(id);
  return row ? toSpot(row) : undefined;
}

/** Lấy các nhóm/quận không trùng theo loại để đưa vào metadata của API. */
export function getFilterOptions(kind) {
  const db = getDb();
  const where = kind ? 'WHERE kind = ?' : '';
  const params = kind ? [kind] : [];

  // Tên cột chỉ đến từ hai lời gọi cố định bên dưới; SELECT DISTINCT lấy mỗi giá trị lọc một lần.
  const read = (column) =>
    db
      .prepare(`SELECT DISTINCT ${column} AS value FROM spots ${where} ORDER BY value ASC`)
      .all(...params)
      .map((row) => row.value)
      .filter((value) => value !== null);

  return { categories: read('category'), districts: read('district') };
}
