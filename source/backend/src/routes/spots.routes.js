/**
 * API DANH MỤC: nhận tham số từ URL, kiểm tra dữ liệu rồi gọi tầng service.
 * GET /api/spots trả danh sách; ?kind=food hoặc place lọc loại; /:id lấy một mục.
 * Router phụ trách HTTP, còn câu SQL nằm trong services/spots.service.js.
 */
/**
 * Các đường dẫn công khai của danh mục:
 * GET /api/spots: tất cả; ?kind=food: món; ?kind=place: địa điểm.
 * GET /api/spots/:id: chi tiết một mục.
 */
import { Router } from 'express';
import { ApiError, sendList, sendObject } from '../utils/http-response.js';
import { SPOT_KINDS, getSpotById, listSpots, getFilterOptions } from '../services/spots.service.js';

export const spotsRouter = Router();

spotsRouter.get('/', (req, res) => {
  const { kind } = req.query;

  // Kiểm tra ngay đầu vào; giá trị ngoài food/place trở thành lỗi 400 thay vì truy vấn tùy ý.
  if (kind !== undefined && !SPOT_KINDS.includes(kind)) {
    throw ApiError.validation(`kind must be one of: ${SPOT_KINDS.join(', ')}.`);
  }

  const spots = listSpots({ kind });
  return sendList(res, spots, {
    kind: kind ?? 'all',
    filters: getFilterOptions(kind),
  });
});

spotsRouter.get('/:id', (req, res) => {
  // req.params.id lấy từ đoạn động /:id trong đường dẫn.
  const spot = getSpotById(req.params.id);

  if (!spot) {
    throw ApiError.notFound(`No spot found with id "${req.params.id}".`);
  }

  return sendObject(res, spot);
});
