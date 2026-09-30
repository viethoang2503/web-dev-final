# Đọc code và thuyết trình Hanoi Local

Website giúp khách khám phá món ăn, quán ăn và địa điểm Hà Nội, sau đó lập lịch nhiều ngày. Frontend dùng HTML, CSS và JavaScript thuần; backend dùng Node.js, Express và SQLite. Dữ liệu seed hiện có **14 món và 10 địa điểm**; database thực tế phụ thuộc lần chạy seed/import trên máy.

## 1. Thứ tự mở file để dễ theo dõi

| Thứ tự | File | Ý chính có thể trình bày |
|---|---|---|
| 1 | `package.json` | `npm start` chạy server; `db:init` tạo cấu trúc; `db:seed` nạp nội dung mẫu. JSON không hỗ trợ comment nên phần giải thích nằm ở tài liệu này. |
| 2 | `source/backend/src/server.js` | Một Express server phục vụ cả API và file HTML/CSS/JS. |
| 3 | `source/backend/src/routes/spots.routes.js` | Nhận yêu cầu HTTP, kiểm tra tham số và gọi service. |
| 4 | `source/backend/src/services/spots.service.js` | Đọc SQLite, đổi tên trường, ghép các quán và trả dữ liệu cho router. |
| 5 | `source/backend/src/database/schema.sql` | Bảng `spots`, khóa chính, điều kiện hợp lệ và chỉ mục. |
| 6 | `source/frontend/public/index.html` và `scripts/pages/home.page.js` | HTML tạo khung; JavaScript điền thẻ nội dung lấy từ API. |
| 7 | `scripts/pages/food.page.js` và `places.page.js` trong thư mục frontend | Tìm kiếm trong dữ liệu đã tải, so quán và chuyển lựa chọn sang Plan. |
| 8 | `source/frontend/public/scripts/pages/plan.page.js` | Nhận thao tác, sửa trạng thái chuyến đi, lưu rồi cập nhật giao diện. |
| 9 | `source/frontend/public/scripts/shared/schedule.js` | Tính giờ, khoảng cách, cảnh báo và thứ tự điểm. |
| 10 | Các module `guide`, `tours`, `library`, `share`, `calendar` trong `scripts/shared` | Lưu cục bộ, dựng tour, lưu bản có tên, chia sẻ và xuất lịch. |

Trong comment, **render** nghĩa là dựng/cập nhật giao diện; **DOM** là cây phần tử HTML mà JavaScript thao tác; **callback** là hàm được truyền vào để gọi lại khi cần.

## 2. Luồng lấy dữ liệu từ server

```text
Mở Food → food.page.js gọi loadSpots()
    → GET /api/spots
    → server.js chuyển tới apiRouter rồi spotsRouter
    → listSpots() đọc bảng spots trong SQLite
    → toSpot() đổi tên trường và ghép FOOD_VENUES theo id món
    → sendList() trả JSON { data, meta }
    → trình duyệt lọc món và dựng thẻ bằng el(), link(), picture()
```

Có thể nói: “Nhóm tách router và service để phần nhận yêu cầu HTTP không phải chứa toàn bộ câu SQL. Frontend nhận JSON rồi tự dựng giao diện bằng JavaScript.”

- `GET /api/health`: kiểm tra server còn phản hồi.
- `GET /api/spots`: toàn bộ danh mục.
- `GET /api/spots?kind=food` hoặc `place`: lọc tại server. Các trang hiện gọi danh mục chung rồi lọc ở trình duyệt.
- `GET /api/spots/:id`: một món/địa điểm; không có thì trả 404.
- `kind` không hợp lệ trả 400; lỗi bất ngờ trả 500 qua middleware chung.

`?` trong câu SQL là chỗ truyền giá trị qua prepared statement. Ứng dụng không nối trực tiếp giá trị `kind` hoặc `id` của người dùng vào câu SQL.

## 3. Dữ liệu nào lưu ở đâu?

| Dữ liệu | Nơi lưu | Vai trò |
|---|---|---|
| Món và địa điểm | SQLite, bảng `spots` | Danh mục chung cho khách truy cập. |
| Quán của từng món | `backend/src/data/food-venues.js` | Ghép vào kết quả API theo id món. |
| Mốc xuất phát và mẫu tour | `frontend/public/scripts/shared/guide.js` | Dữ liệu cấu hình để gợi ý lịch. |
| Lịch đang chỉnh và món yêu thích | `localStorage`, qua `guide.js` | Tải lại trang vẫn đọc được trên trình duyệt đó. |
| Lịch có tên và tour tự lưu | `localStorage`, qua `library.js` | Tối đa 10 bản cho mỗi loại. |
| Lịch trong link chia sẻ | Phần `#plan=` của URL | Máy nhận đọc một bản sao từ link; không có bảng lịch trên server. |

Không có đăng nhập hoặc tự đồng bộ nhiều thiết bị trong phiên bản hiện tại. Base64url trong link chỉ biểu diễn dữ liệu, không bảo mật nội dung lịch.

## 4. Luồng thêm một điểm vào lịch

```text
Khách chọn món/quán/buổi → submit form → preventDefault()
    → addStop() kiểm tra giới hạn 8 điểm/ngày và trùng điểm
    → snapshotDay() giữ bản cũ để Undo
    → thêm stop vào trip.days[activeDay].stops
    → save() ghi localStorage
    → renderTimeline() gọi scheduleFor() → scheduleDay()
    → dựng giờ, cảnh báo, tóm tắt và gợi ý gần
```

`trip` là dữ liệu chuyến đi. `activeDay = 0` là Ngày 1; mỗi ngày chứa mảng `stops`. Một điểm có `spotId`, `kind`, `slot`; món ăn có thể có thêm `venueId`. Giờ ghim và thời lượng riêng nằm trong `startTime` và `duration`.

Có thể nói: “Sau mỗi thao tác, em cập nhật dữ liệu trước, lưu lại rồi dựng giao diện từ dữ liệu mới. Undo khôi phục bản chụp của ngày trước thao tác.”

## 5. Giải thích thuật toán bằng ví dụ

**Xếp giờ:** sáng từ 08:00, chiều từ 12:00, tối từ 18:00. Giờ lưu bằng số phút: 08:00 là 480. Món mặc định 50 phút; địa điểm dùng `durationMinutes`, thiếu thì 60 phút. Điểm tự nhập mặc định 60 phút.

Ví dụ điểm đầu bắt đầu 08:00, ở lại 50 phút, đi tới điểm sau mất 15 phút: điểm sau trong cùng buổi bắt đầu 09:05. Công thức là `max(giờ đầu buổi, giờ kết thúc điểm trước + thời gian di chuyển)`. Điểm đầu hiện bắt đầu theo buổi, chưa cộng thời gian đi từ mốc xuất phát. Nếu khách ghim giờ, giữ giờ đó và cảnh báo khi quá sát điểm trước.

**Khoảng cách:** `approxKm()` dùng Haversine với tọa độ để tính đường chim bay. `travelMinutes()` nhân khoảng cách với hệ số 1,3, giả định đi bộ ở quãng ngắn hoặc xe ở quãng dài, làm tròn lên bội số 5 phút và tối thiểu 10 phút. Đây là ước tính; Google Maps mới cung cấp tuyến đường thực tế.

**Tour:** `buildTourStops()` đi qua từng bước của mẫu, chọn ứng viên có tổng điểm thấp nhất từ khoảng cách, độ phù hợp chủ đề và việc đã dùng ở ngày khác. Khi không đủ điểm mới, cho phép dùng lại với mức ưu tiên thấp hơn. Tour được dựng theo quy tắc, không dùng mô hình AI.

**Rút ngắn tuyến:** `optimizeOrder()` chọn điểm gần nhất trong từng buổi, giữ vị trí điểm ghim giờ. Đây là cách tìm gần đúng, không bảo đảm tối ưu toàn cục. Trang Plan chỉ áp dụng khi khoảng cách tính lại giảm hơn 0,05 km.

**Giờ mở cửa:** `openingWarning()` đọc một số mẫu chuỗi trong danh mục để phát cảnh báo. Không có dữ liệu mở cửa trực tiếp của từng quán. Điểm tự nhập không có tọa độ/giờ mở cửa nên không kiểm tra được như điểm trong danh mục.

## 6. HTML, CSS và khả năng truy cập

HTML cung cấp các vùng có `id` để JavaScript chọn và cập nhật. `type="module"` cho phép chia mã thành nhiều file bằng `import`. Các form được xử lý tại trình duyệt để thao tác không tải lại trang.

CSS được chia thành font, biến thiết kế, quy tắc nền và quy tắc riêng từng trang. Grid chia bố cục; Flex sắp nhóm nút; `var(...)` dùng lại màu/khoảng cách. Bố cục hiện chủ yếu dành cho desktop, không nên trình bày là đã tối ưu đầy đủ cho điện thoại.

`aria-selected`, `aria-controls`, `role="status"` và `focus-visible` giúp tab, thông báo và thao tác bàn phím rõ ràng hơn. `inert` khóa vùng lập lịch trong lúc API chưa tải xong. `textContent` đưa nội dung chữ vào DOM mà không phân tích thành HTML.

## 7. Chia sẻ, in và lịch điện thoại

- `share.js`: chuẩn hóa lịch, chuyển JSON thành base64url để đặt vào hash của URL; mở link sẽ giải mã thành một bản lịch.
- `renderPrintView()` và `@media print` trong `plan.css`: dựng mọi ngày có điểm thành bản in; khi in ẩn form và thanh công cụ.
- `calendar.js`: mỗi điểm dừng là một sự kiện trong file `.ics`; thoát ký tự và ngắt dòng theo byte UTF-8. Giờ xuất là floating, **không gắn múi giờ Asia/Ho_Chi_Minh**.

## 8. Cách chứng minh khi demo

1. Mở Home, chuyển Food, tìm món và đổi mốc xuất phát để thấy quán được xếp lại.
2. Lưu món yêu thích, chuyển Places và tìm địa điểm.
3. Mở Plan, chọn hai ngày và áp dụng tour; chỉ rõ mỗi ngày có danh sách riêng.
4. Thêm điểm, đổi thời lượng hoặc thứ tự, xem giờ cập nhật; bấm Undo để khôi phục.
5. Tải lại trang để chứng minh localStorage giữ lịch; thử chia sẻ, in hoặc tải `.ics`.

Chạy `npm run qa:structure` để kiểm tra đường dẫn và `npm run qa:schedule` để kiểm tra logic. `qa:guide` và `qa:plan` cần server cùng Chrome/Chromium để kiểm tra giao diện. `scripts/benchmark-api.mjs` đo API GET trong điều kiện máy local; `scripts/optimize-images.mjs` là công cụ xử lý ảnh, không chạy trong luồng người dùng.

Mã chính nằm trong `source/`. `node_modules` là thư viện cài từ npm; `.git` là lịch sử Git; `.codegraph` là chỉ mục hỗ trợ đọc mã; ảnh, font và SQLite là tài nguyên nhị phân nên không thêm comment trực tiếp.
