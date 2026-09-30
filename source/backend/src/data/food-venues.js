/**
 * LIÊN KẾT MÓN VÀ QUÁN: khóa ngoài là spotId của món; giá trị là danh sách quán phục vụ món đó.
 * venueId xác định quán được chọn trong lịch; lat/lng dùng để ước tính và sắp quán gần trước.
 */
/**
 * Quán ăn gợi ý cho từng món. Mỗi quán là một địa điểm riêng, không phải
 * một "địa chỉ của món ăn". Tọa độ được làm tròn để chỉ xếp gần/xa tương đối;
 * Google Maps mới là nơi xem đường đi thực tế.
 *
 * Địa chỉ đối chiếu từ kết quả địa điểm Google, trang quán và danh bạ ngày
 * 28/09/2026. Giờ mở cửa thay đổi thường xuyên nên không lưu giờ giả định.
 */
const venue = (id, name, address, district, lat, lng) => ({
  id, name, address, district, lat, lng,
});

export const FOOD_VENUES = Object.freeze({
  // Món bổ sung từ tài liệu nhóm. Nguồn đối chiếu nằm trong food-sources.json.
  // Tọa độ là mốc khu vực ước tính, không phải định vị chính xác cửa quán.
  'food-chao-suon': [
    venue('chao-suon-huyen-anh-dong-xuan', 'Cháo Sườn Huyền Anh · Đồng Xuân', '14 Đồng Xuân, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.038, 105.849),
    venue('chao-suon-huyen-anh-hang-vai', 'Cháo Sườn Huyền Anh · Hàng Vải', '4A Hàng Vải, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.037, 105.848),
  ],
  'food-bun-dau-mam-tom': [
    venue('bun-dau-trung-huong', 'Bún Đậu Trung Hương', '49 ngõ Phất Lộc, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.035, 105.854),
    venue('bun-dau-cay-da', 'Bún Đậu Cây Đa', '235B Thụy Khuê, Tây Hồ, Hà Nội', 'Tay Ho', 21.043, 105.818),
  ],
  'food-bun-rieu': [
    venue('bun-rieu-hang-bac', 'Bún Riêu Hàng Bạc', '11 Hàng Bạc, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.034, 105.853),
    venue('bun-rieu-hang-luoc', 'Bún Riêu Hàng Lược', '16 Hàng Lược, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.037, 105.849),
  ],
  'food-nem-cuon': [
    venue('cuon-n-roll-giang-vo', 'Cuốn N Roll · Giảng Võ', 'Tầng 3, nhà D2 Giảng Võ, Ba Đình, Hà Nội', 'Ba Dinh', 21.026, 105.82),
    venue('cuon-n-roll-tran-thai-tong', 'Cuốn N Roll · Trần Thái Tông', '90 Trần Thái Tông, Cầu Giấy, Hà Nội', 'Cau Giay', 21.031, 105.79),
  ],
  'food-pho-bo': [
    venue('pho-bat-dan', 'Phở Bát Đàn', '49 Bát Đàn, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.033, 105.846),
    venue('pho-thin-lo-duc', 'Phở Thìn Lò Đúc', '13 Lò Đúc, Hai Bà Trưng, Hà Nội', 'Hai Ba Trung', 21.017, 105.856),
  ],
  'food-bun-cha': [
    venue('bun-cha-dac-kim', 'Bún Chả Đắc Kim', '1 Hàng Mành, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.031, 105.847),
    venue('bun-cha-huong-lien', 'Bún Chả Hương Liên', '24 Lê Văn Hưu, Hai Bà Trưng, Hà Nội', 'Hai Ba Trung', 21.015, 105.853),
  ],
  'food-banh-mi': [
    venue('banh-mi-25', 'Bánh Mì 25', '25 Hàng Cá, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.037, 105.849),
    venue('banh-mi-p', 'Bánh Mì P', '12 Hàng Buồm, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.036, 105.852),
  ],
  'food-ca-phe-trung': [
    venue('cafe-giang', 'Café Giảng', '39 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.034, 105.854),
    venue('cafe-dinh', 'Café Đinh', 'Tầng 2, 13 Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.032, 105.853),
  ],
  'food-cha-ca': [
    venue('cha-ca-la-vong', 'Chả Cá Lã Vọng', '14 Chả Cá, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.035, 105.849),
    venue('cha-ca-thang-long', 'Chả Cá Thăng Long', '6B Đường Thành, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.033, 105.846),
  ],
  'food-banh-cuon': [
    venue('banh-cuon-ba-hanh', 'Bánh Cuốn Bà Hanh', '26B Thọ Xương, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.028, 105.846),
    venue('banh-cuon-thanh-van', 'Bánh Cuốn Thanh Vân', '14 Hàng Gà, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.037, 105.847),
  ],
  'food-bun-thang': [
    venue('bun-thang-ba-duc', 'Bún Thang Bà Đức', '48 Cầu Gỗ, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.031, 105.853),
    venue('bun-thang-thanh-van', 'Bún Thang Thanh Vân', '14 Hàng Gà, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.037, 105.847),
  ],
  'food-xoi-xeo': [
    venue('xoi-yen', 'Xôi Yến', '35B Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.034, 105.854),
    venue('xoi-ba-thu', 'Xôi Bà Thu', '57 Thợ Nhuộm, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.024, 105.847),
  ],
  'food-nem-cua-be': [
    venue('nem-cua-be-hoang-yen', 'Bún Chả Nem Cua Bể Hoàng Yến', '2 Lý Thái Tổ, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.032, 105.856),
    venue('nem-cua-be-hang-ma', 'Bún Chả Nem Cua Bể Hàng Mã', '59 Hàng Mã, Hoàn Kiếm, Hà Nội', 'Hoan Kiem', 21.039, 105.845),
  ],
  'food-pho-cuon': [
    venue('pho-cuon-huong-mai', 'Phở Cuốn Hương Mai', '25 Ngũ Xã, Ba Đình, Hà Nội', 'Ba Dinh', 21.045, 105.838),
    venue('pho-cuon-hung-ben', 'Phở Cuốn Hưng Bền', '118 Trấn Vũ, Ba Đình, Hà Nội', 'Ba Dinh', 21.044, 105.836),
  ],
});
