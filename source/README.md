# Source code Hanoi Local

Mục tiêu: mở bốn trang nhanh để trình bày trong 5 phút. Giữ logic dễ đọc,
không dùng framework frontend hoặc API bản đồ có khóa.

## frontend/public

- `index.html`: trang chủ và ba tour mẫu.
- `food.html`: món ăn, nhiều quán cho mỗi món, lưu món yêu thích.
- `places.html`: điểm tham quan.
- `plan.html`: lịch 1 đến 3 ngày.
- `scripts/pages/`: JavaScript khởi tạo và xử lý riêng cho từng trang.
- `scripts/shared/guide.js`: mốc xuất phát, tour mẫu, localStorage, ước lượng khoảng cách và link Maps.
- `scripts/shared/ui.js`: tạo phần tử HTML bằng `textContent`.
- `styles/guide.css`: giao diện danh mục và lịch; phần Home dùng thêm `pages.css` và `home-components.css`.
- `assets/`, `uploads/`: ảnh và font được Express phục vụ công khai.

## backend/src

- `server.js`: khởi động Express, phục vụ API rồi phục vụ file tĩnh.
- `routes/`: `GET /api/spots` và `GET /api/health`.
- `services/spots.service.js`: đọc SQLite và đổi tên cột thành JSON cho frontend.
- `data/food-venues.js`: tối thiểu hai quán cho mỗi món; địa chỉ đã kiểm tra, tọa độ làm tròn để xếp gần/xa tương đối.
- `database/`: kết nối, schema và seed 20 bản ghi.
- `middleware/image-resolver.middleware.js`: chọn AVIF/WebP/JPG hiện có.

## data

`backend/data/hanoi-local.sqlite` là dữ liệu local. Database cũ có thể còn
bảng tài khoản của phiên bản trước. Trang web hiện nay không dùng các bảng ấy
và không xóa chúng khi khởi động.
