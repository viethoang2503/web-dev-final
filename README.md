# Hanoi Local

Website hướng dẫn khám phá Hà Nội cho bài thuyết trình 5 phút. Ba phần chính:

1. **Eat & drink:** xem 10 món; mỗi món có ít nhất 2 quán cụ thể.
2. **See & do:** tìm điểm tham quan, xem thời gian tham khảo và mở Google Maps.
3. **Plan your day:** chọn ngày bắt đầu và ngày kết thúc (1-30 ngày), chọn mốc xuất phát rồi dùng tour mẫu hoặc tự thêm điểm dừng. Tour mẫu được dựng theo mốc xuất phát và mỗi ngày một khác; nút "Fill every empty day" điền các ngày còn trống bằng các tour khác nhau.

Trong Plan có thể dời thứ tự điểm dừng, ghim giờ, mở cả tuyến trong Google Maps, chia sẻ lịch bằng link (lịch nằm trong phần `#plan=` của URL, không qua server), in lịch và tải file `.ics` cho lịch điện thoại. Có nút Optimise order (sắp lại trong từng buổi theo điểm gần nhất), mục Nearby ideas (gợi ý điểm gần và còn mở cửa), lưu tối đa 10 lịch có tên và 10 tour tự tạo trong trình duyệt.

Không cần tài khoản. Món yêu thích và lịch nằm trong `localStorage` của trình duyệt hiện tại, nên sẽ không tự đồng bộ sang máy khác.

## Chạy local

Cần Node.js 22.5+.

```sh
npm ci
npm run db:init
npm run db:seed
npm start
```

Mở [http://localhost:3000](http://localhost:3000). Dùng `npm run dev` khi muốn server tự khởi động lại sau khi sửa backend.

`db:init` chỉ tạo bảng còn thiếu; `db:seed` cập nhật catalogue bằng upsert. Không cần chạy `db:reset` trên máy đã có dữ liệu. File SQLite mặc định là `source/backend/data/hanoi-local.sqlite`, nằm ngoài Git. Nếu có `.env` cũ, sửa `DATABASE_PATH` theo đường dẫn mới.

## Cấu trúc

Xem [source/README.md](source/README.md) để biết vai trò từng thư mục.

```text
source/
  frontend/public/      HTML, CSS, JavaScript, ảnh
  backend/src/          Express API và SQLite
  backend/data/         Database local (không commit)
tests/                  Kiểm tra luồng demo
scripts/                Benchmark và tối ưu ảnh
docs/                   Tài liệu nội bộ, bị Git bỏ qua
```

Trình duyệt gọi `GET /api/spots` để lấy 10 món và 10 địa điểm. Quán của từng món được lưu trong `source/backend/src/data/food-venues.js`. Mốc và tọa độ làm tròn nằm trong `source/frontend/public/scripts/shared/guide.js`.

## Cách hiểu “quán gần”

Sau khi khách chọn mốc xuất phát, web tính **khoảng cách đường chim bay ước tính** đến các quán và xếp quán gần lên trước. Đây chỉ là thứ tự gợi ý. Nút **Directions** mở Google Maps để xem quãng đường đi bộ thực tế. Không cần API key để tạo Maps URL.

Lịch tự xếp giờ theo ba buổi: sáng từ 08:00, chiều từ 12:00, tối từ 18:00. Mỗi điểm có thời gian ở lại và khoảng đệm 15 hoặc 30 phút giữa các điểm tùy quận. Giờ mở cửa của quán cần kiểm tra lại trên Maps; thời gian và vị trí trong web không phải dữ liệu định tuyến thời gian thực.

## Kiểm tra

Chạy server trước rồi chạy `npm run qa`. Lệnh này kiểm tra đường dẫn source và luồng Home → món/quán → tour → lịch nhiều ngày bằng Chrome. `npm run benchmark` chỉ đo các API GET trên máy local.

Home giữ bố cục desktop theo mockup. Food, Places và Plan được làm gọn để demo nhanh. Tài liệu và mockup của nhóm còn trên máy trong `docs/`, không được đẩy lên Git.

## Luồng demo 5 phút

1. **0:00-0:40:** Home: giới thiệu Hà Nội và ba tour gợi ý.
2. **0:40-1:50:** Eat & drink: tìm phở, đổi mốc xuất phát, so hai quán và chỉ vào nút Directions. Lưu món vào Favorites trên máy.
3. **1:50-2:30:** See & do: tìm Temple of Literature, xem thời gian tham quan và nút Add to plan.
4. **2:30-4:20:** Plan your day: chọn ngày bắt đầu và hai ngày, dùng một tour cho ngày 1, thêm món/địa điểm vào ngày 2, đổi quán và xem giờ dự kiến.
5. **4:20-5:00:** Tải lại trang để chứng minh lịch còn; giải thích khoảng cách là ước tính, Google Maps hiển thị đường đi thực tế.
