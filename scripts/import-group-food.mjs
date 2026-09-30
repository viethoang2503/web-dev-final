/**
 * CÔNG CỤ BỔ SUNG MÓN: tìm id trong tài liệu nhóm chưa có ở database rồi seed riêng tập đó.
 * Lệnh này giả định bảng spots đã tồn tại; finally đóng kết nối kể cả khi nhập bị lỗi.
 */
/** Bổ sung riêng món từ tài liệu nhóm, không reset DB hoặc ghi đè món có sẵn. */
import { GROUP_FOOD } from '../source/backend/src/data/group-food.js';
import { spots } from '../source/backend/src/database/seed-data.js';
import { seedDatabase } from '../source/backend/src/database/seed.js';
import { getDb, closeDb } from '../source/backend/src/database/connection.js';

const ids = new Set(GROUP_FOOD.map(item => item.id));
const exists = getDb().prepare('SELECT id FROM spots WHERE id = ?');
const additions = spots.filter(item => ids.has(item.id) && !exists.get(item.id));
try {
  seedDatabase(additions);
  console.log(`Added ${additions.length} group-selected dishes. Existing records unchanged.`);
} finally { closeDb(); }
