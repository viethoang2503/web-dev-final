# Hanoi Local — Final Project Web Dev Application

**Group 33**

1. Vu Quang Huy
2. Nguyen Khac Hung
3. Bui Viet Hoang
4. Nguyen Ba Khoa
5. Nghiem Trong Quoc Anh

## Project handoff

Thư mục này là nguồn tài liệu thống nhất cho final project website hướng dẫn du lịch Hà Nội.

## Quyết định đã chốt

- Tên sản phẩm: **Hanoi Local**.
- Frontend: HTML, CSS và JavaScript thuần.
- Backend: Node.js + Express.
- Database: SQLite.
- Ngôn ngữ bản nộp: English.
- Song ngữ Việt–Anh: chuyển sang Future Development.
- Phạm vi chính: Home, Food, Places, Account, Favorites và My Day.
- Phong cách: editorial city guide, lấy cảm hứng từ nhịp bố cục của I amsterdam nhưng không sao chép thương hiệu.

## Tài liệu

1. [Design Style](docs/01-design-style.md) — màu sắc, typography, layout, component và responsive rules.
2. [Product Spec](docs/02-product-spec.md) — phạm vi, user flow, tính năng và acceptance criteria.
3. [Technical Spec](docs/03-technical-spec.md) — kiến trúc, database, API và quy tắc backend.
4. [Task Breakdown](docs/04-task-breakdown.md) — chia việc tối đa 7 thành viên, dependency và Definition of Done.
5. [Testing and Scoring](docs/05-testing-and-scoring.md) — test matrix, tối ưu, benchmark và kịch bản thuyết trình.

## Ảnh thiết kế tham chiếu

![Hanoi Local landing-page mockup](docs/assets/hanoi-local-landing-mockup.png)

Ảnh mockup dùng để thống nhất hướng thẩm mỹ. Khi code, ưu tiên tính responsive, accessibility và khả năng giải thích hơn việc khớp từng pixel.

## Thứ tự bắt đầu

1. Cả nhóm đọc Product Spec và chốt dữ liệu 10 Food + 10 Places.
2. Thành viên phụ trách kiến trúc tạo project skeleton và database schema.
3. Thành viên UI tạo design tokens và shared components.
4. Food, Places và backend auth có thể triển khai song song.
5. Favorites và My Day chỉ bắt đầu sau khi auth/session chạy ổn định.
6. QA tích hợp sớm, không đợi đến ngày cuối.
