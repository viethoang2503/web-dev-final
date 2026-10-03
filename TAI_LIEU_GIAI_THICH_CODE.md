# Hanoi Local: giải thích toàn bộ logic và code

Tài liệu này giải thích website **Hanoi Local** từ tổng thể đến từng file, dựa trên mã nguồn hiện tại. Đọc theo thứ tự các mục sẽ đi từ "hệ thống làm gì" đến "từng hàm chạy ra sao". Mỗi mục lớn có thể đọc độc lập.

**Cách đọc:** những thuật ngữ khó (DOM, render, middleware, singleton, Haversine...) được giải thích ở [mục 15](#15-thuật-ngữ). Tên file được viết trong `dấu huyền`; đường dẫn tính từ thư mục gốc project.

## Mục lục

1. Tổng quan hệ thống
2. Công nghệ và lý do chọn
3. Cấu trúc thư mục
4. Chạy dự án và vòng đời khởi động
5. Backend
6. Cơ sở dữ liệu
7. Frontend: nền tảng dùng chung
8. Frontend: thuật toán lập lịch (`schedule.js`)
9. Frontend: các trang
10. Trang Plan chi tiết (`plan.page.js`)
11. Mô hình dữ liệu chuyến đi
12. Các luồng end-to-end
13. Bảo mật và hiệu năng
14. Kiểm thử, công cụ và hạn chế đã biết
15. Thuật ngữ

---

## 1. Tổng quan hệ thống

### 1.1. Bài toán

Hanoi Local là website tiếng Anh giúp **du khách nước ngoài** khám phá món ăn và địa điểm ở Hà Nội, rồi biến chúng thành **lịch trình 1 đến 30 ngày có giờ cụ thể**. Hệ thống trả lời bốn câu hỏi: ăn gì và ở quán nào, đi đâu, cái nào gần cái nào, và nên đến lúc mấy giờ.

### 1.2. Các trang

| Trang | File | Nhiệm vụ | Cần đăng nhập |
|---|---|---|---|
| Home | `index.html` | Giới thiệu, ba tour mẫu, vài món và địa điểm nổi bật | Không |
| Eat & drink | `food.html` | Tìm món, xem các quán, xếp quán theo khoảng cách, lưu món yêu thích | Không |
| See & do | `places.html` | Tìm địa điểm, xem thời lượng, vé, mở Google Maps | Không |
| Plan your day | `plan.html` | Lập lịch nhiều ngày | **Có** (server chặn) |
| Login | `login.html` | Đăng ký, đăng nhập email, đăng nhập Google | Không |
| Upgrade | `upgrade.html` | Nâng cấp Premium bằng mã QR (giả lập) | Cần để bấm nâng cấp |
| Pay | `pay.html` | "Ngân hàng" giả lập, mở bằng mã QR | Không (mã đơn là bí mật) |
| Admin | `admin.html` | Quản lý người dùng, thêm/sửa/xoá món và địa điểm | **Admin** (server chặn) |

### 1.3. Kiến trúc trong một hình

```
                       ┌───────────────────────────── Trình duyệt ─────────────────────────────┐
                       │ HTML + CSS + JavaScript ES Modules (không framework)                   │
                       │   pages/*.page.js  ← mỗi trang một file khởi tạo                        │
                       │   shared/*.js      ← module dùng chung (guide, schedule, tours, ...)    │
                       │   localStorage     ← lịch đang sửa, lịch có tên, tour, món yêu thích    │
                       └───────┬───────────────────────────────────────────────┬────────────────┘
                               │ fetch JSON                                    │ mở link
                  GET /api/... │ POST /api/... (cookie phiên)                  ▼
                               ▼                                          Google Maps
       ┌───────────────── Một tiến trình Node.js (Express) ───────────────────┐
       │ page guards (/plan, /admin) → resolveImage → express.static           │
       │ /api → express.json → authRouter │ spotsRouter │ billingRouter │ admin │
       │            └──────── services (auth, spots, billing, admin) ────────┘  │
       └───────────────────────────────┬──────────────────────────────────────┘
                                       ▼
                         SQLite (spots, users, payments, payment_orders)
                         + data/food-venues.js (quán của từng món, nằm trong mã nguồn)
```

### 1.4. Ba ý tưởng thiết kế cần nhớ

1. **Một server, hai vai trò.** Express vừa phục vụ file tĩnh (HTML/CSS/JS/ảnh) vừa cung cấp API. Frontend gọi API bằng đường dẫn tương đối (`/api/spots`), không cần cấu hình CORS.
2. **Danh mục ở server, lịch ở trình duyệt.** Món và địa điểm nằm trong SQLite và được mọi người dùng chia sẻ. Lịch trình của từng người nằm trong `localStorage`, nên thao tác lập lịch tức thời và không cần API ghi.
3. **Logic xếp lịch là hàm thuần.** `schedule.js` không đụng DOM hay `localStorage`: nhận dữ liệu, trả kết quả. Nhờ vậy test được bằng Node mà không cần mở trình duyệt.

---

## 2. Công nghệ và lý do chọn

| Công nghệ | Dùng ở đâu | Lý do |
|---|---|---|
| Node.js ≥ 22.5 | Toàn bộ backend, script, test | Có sẵn `node:sqlite` và `process.loadEnvFile`, không cần thư viện ngoài cho DB và `.env` |
| Express 5.1 | `server.js`, các router | Định tuyến và middleware đơn giản; Express 5 tự chuyển lỗi `throw` trong handler đồng bộ/`async` sang middleware lỗi |
| `node:sqlite` (`DatabaseSync`) | `connection.js` | Database dạng file, không cần máy chủ riêng; API đồng bộ nên code dễ đọc |
| `google-auth-library` | `auth.service.js` | Xác minh ID token do Google cấp |
| `qrcode` | `billing.service.js` | Sinh ảnh QR dạng SVG |
| HTML/CSS/JS thuần (ES Modules) | Frontend | Hiểu rõ nền tảng web; dự án đủ nhỏ để không cần framework |
| `localStorage` | `guide.js`, `library.js` | Lưu lịch cá nhân, không cần tài khoản đồng bộ |
| Google Maps (chỉ là URL) | `guide.js` | Không cần API key; chỉ tạo link tìm kiếm/chỉ đường |

`package.json` khai báo `"type": "module"` nên mọi file `.js` dùng `import`/`export`. Chỉ có **3 dependency**: `express`, `google-auth-library`, `qrcode`.

---

## 3. Cấu trúc thư mục

```
.
├── package.json                 Script npm và dependency
├── .env / .env.example          Cấu hình (không commit .env)
├── README.md                    Giới thiệu, cài đặt
├── source/
│   ├── backend/
│   │   ├── data/                File SQLite local (không commit)
│   │   └── src/
│   │       ├── server.js        Điểm bắt đầu
│   │       ├── config/environment.js
│   │       ├── routes/          api, auth, spots, billing, admin
│   │       ├── services/        auth, spots, billing, admin (nghiệp vụ + SQL)
│   │       ├── middleware/      auth, error-handler, image-resolver
│   │       ├── database/        connection, schema.sql, initialize, seed, seed-data
│   │       ├── data/            food-venues.js, group-food.js, food-sources.json
│   │       └── utils/http-response.js
│   └── frontend/public/         Thư mục được phục vụ công khai
│       ├── *.html               8 trang
│       ├── scripts/pages/       Một file khởi tạo cho mỗi trang
│       ├── scripts/shared/      Module dùng chung
│       ├── styles/              CSS chia theo vai trò
│       └── assets/              Ảnh (WebP/AVIF) và font
├── tests/                       Kiểm thử (Node thuần + Chrome headless)
└── scripts/                     Benchmark, tối ưu ảnh, import món
```

**Quy tắc phân tầng backend:** `routes` chỉ nhận HTTP và gọi `services`; `services` chứa nghiệp vụ và SQL; `database` quản lý kết nối và cấu trúc. Router không viết SQL, service không biết gì về `req`/`res` (trừ `billing` cần `req` để dựng URL).

---

## 4. Chạy dự án và vòng đời khởi động

### 4.1. Các lệnh

| Lệnh | Tác dụng |
|---|---|
| `npm start` | `node source/backend/src/server.js` |
| `npm run dev` | Như trên với `--watch` (tự khởi động lại khi sửa backend) |
| `npm run db:init` | Tạo bảng còn thiếu |
| `npm run db:seed` | Nạp danh mục mẫu bằng upsert |
| `npm run db:reset` | Xoá file DB, tạo lại, rồi seed. **Mất dữ liệu** |
| `npm run qa` | Chạy bốn bộ kiểm thử |
| `npm run benchmark` | Đo API GET |
| `npm run assets:webp` | Chạy script tối ưu ảnh (cần tham số thư mục nguồn) |

### 4.2. Điều gì xảy ra khi `npm start`

```
1. Node nạp server.js → import config/environment.js
2. environment.js: tính projectRoot từ import.meta.url, đọc .env bằng process.loadEnvFile,
   dựng đối tượng config (port, databasePath, googleClientId, sessionSecret, adminEmails, publicUrl, publicDir)
3. server.js gọi initDatabase():
     renameLegacyUsers → db.exec(schema.sql) → copyLegacyUsers → addMissingColumns
4. Tạo app Express, tắt x-powered-by
5. Gắn middleware theo đúng thứ tự (xem 5.2)
6. app.listen(config.port) → in địa chỉ và đường dẫn DB
7. Đăng ký SIGINT/SIGTERM để server.close() rồi thoát gọn
```

Lưu ý: `initDatabase()` chỉ tạo **cấu trúc**. Muốn có món và địa điểm phải chạy thêm `npm run db:seed`.

---

## 5. Backend

### 5.1. `config/environment.js`: cấu hình

- `projectRoot` được suy ra từ vị trí file (`import.meta.url`), nên chạy `npm start` từ thư mục nào cũng đúng.
- Nếu có `.env`, gọi `process.loadEnvFile()` để nạp vào `process.env`. Không có `.env` vẫn chạy với giá trị mặc định.
- `config.databasePath` luôn được `path.resolve` từ `projectRoot`, mặc định `./source/backend/data/hanoi-local.sqlite`.
- `config.sessionSecret` mặc định là chuỗi dev (`dev-only-secret-change-me`). **Phải đặt `SESSION_SECRET` thật khi deploy**, vì ai biết chuỗi này có thể tự ký cookie phiên.
- `config.adminEmails` là danh sách email (chuyển thường, bỏ trống) sẽ tự thành admin.
- `config.publicUrl` bỏ dấu `/` cuối; dùng khi dựng URL mã QR.
- `config.isProduction` chỉ đúng khi `NODE_ENV === 'production'`; nó bật cờ `secure` của cookie và cache file tĩnh.

### 5.2. `server.js`: thứ tự middleware

Thứ tự đăng ký quyết định thứ tự xử lý, nên rất quan trọng:

```
app.use('/api', apiRouter)            ← API đi trước, nên không bao giờ bị file tĩnh "nuốt"
app.use('/api', apiNotFound)          ← /api/... không khớp route nào → 404 JSON
app.get(['/plan','/plan.html'], requireUserPage)   ← chặn trước khi phát file HTML
app.get(['/admin','/admin.html'], requireAdminPage)
app.use(resolveImage)                 ← URL ảnh không có đuôi → chọn AVIF/WebP/JPG
app.use(express.static(publicDir, { extensions:['html'], maxAge: production ? '1h' : 0 }))
app.use(errorHandler)                 ← bắt lỗi từ mọi bước trước (đủ 4 tham số)
```

- `extensions: ['html']` cho phép mở `/food` thay vì `/food.html`.
- Hai route trang được bảo vệ phải đặt **trước** `express.static`, nếu không file `plan.html` đã được phát ra mà chưa kiểm tra quyền.

### 5.3. `routes/api.routes.js`

- `apiRouter.use(express.json({ limit: '20kb' }))`: parse body JSON cho mọi API ghi, giới hạn 20 KB để chặn body quá lớn.
- `GET /api/health` trả `{ data: { status: 'ok', time } }` (dùng cho demo, benchmark và để `db:init --fresh` kiểm tra server còn chạy).
- Gắn bốn router con: `/auth`, `/admin`, `/billing`, `/spots`.

### 5.4. `utils/http-response.js` và `middleware/error-handler.middleware.js`

**Quy ước phản hồi thống nhất** để frontend đọc một kiểu:

| Trường hợp | Dạng JSON |
|---|---|
| Danh sách | `{ "data": [...], "meta": { "count": n, ... } }` |
| Một đối tượng | `{ "data": {...} }` |
| Lỗi | `{ "error": { "code", "message", "details"? } }` |

`ApiError` kế thừa `Error`, mang `code` và `status`. Có sẵn hàm tạo `validation` (400), `unauthorized` (401), `forbidden` (403), `notFound` (404), `conflict` (409), `rateLimited` (429). Mã lạ tự thành `INTERNAL_ERROR` (500). Thông báo mặc định không chứa SQL hay stack trace.

`errorHandler` xử lý theo thứ tự:
1. Nếu header đã gửi → chuyển tiếp `next(err)`.
2. `ApiError` → trả JSON đúng status (lỗi ≥ 500 được ghi log).
3. `err.type === 'entity.parse.failed'` (body JSON sai cú pháp) → 400.
4. Còn lại → ghi log đầy đủ ở server, trả 500 với thông báo chung.

Nhờ Express 5, router chỉ cần `throw ApiError.xxx(...)`, kể cả trong handler `async`.

### 5.5. `routes/spots.routes.js` và `services/spots.service.js`: danh mục

**Router:**
- `GET /api/spots?kind=food|place`: nếu `kind` có mặt mà không thuộc `['food','place']` → `ApiError.validation` (400). Trả `sendList` kèm `meta.kind` và `meta.filters` (các category/district không trùng).
- `GET /api/spots/:id`: không có → 404.

**Service:**
- `SELECT_COLUMNS` liệt kê cột rõ ràng (không dùng `SELECT *`).
- `toSpot(row)` đổi `snake_case` → `camelCase` và **tách trường theo loại**: món có `priceLevel` và `venues`; địa điểm có `admission`, `isFree`, `durationMinutes`, `lat`, `lng`.
- `venues` không nằm trong SQLite: lấy từ `FOOD_VENUES[row.id]` (file `data/food-venues.js`).
- `listSpots` sắp xếp `ORDER BY featured DESC, rating DESC, name ASC`; điều kiện `WHERE kind = ?` dùng tham số `?`.
- `getFilterOptions` lấy `SELECT DISTINCT` cho `category` và `district`.

**Tại sao không nối chuỗi SQL với dữ liệu người dùng?** Mọi giá trị (`kind`, `id`) đi qua `?` của prepared statement nên không thể bị tiêm lệnh SQL. Phần chuỗi được ghép (như tên cột trong `getFilterOptions`) chỉ đến từ hai lời gọi cố định trong code.

### 5.6. Xác thực: `services/auth.service.js`

**Mật khẩu (scrypt):**
- `hashPassword`: sinh salt ngẫu nhiên 16 byte, băm bằng `scrypt` (64 byte), lưu dạng `scrypt$<salt hex>$<hash hex>`.
- `verifyPassword`: tách chuỗi đã lưu, băm lại mật khẩu nhập với cùng salt, so sánh bằng `timingSafeEqual` (thời gian so sánh không phụ thuộc vị trí byte khác nhau, chống tấn công đo thời gian). Sai định dạng → `false`.

**Đăng ký (`registerUser`):** kiểm tra tên (1–80 ký tự), email (regex và ≤ 254 ký tự, chuẩn hoá chữ thường), mật khẩu (8–128 ký tự). Email đã tồn tại → 409. Sau khi `INSERT`, gọi `promoteIfListed`.

**Đăng nhập (`loginWithPassword`)**, theo thứ tự:
1. Chuẩn hoá email, tạo khoá giới hạn `ip|email`.
2. `assertNotLocked`: nếu đã sai ≥ 8 lần trong 15 phút → 429.
3. Tìm user, `verifyPassword`. Sai/không có tài khoản/tài khoản chỉ dùng Google đều trả **cùng một thông báo** `Incorrect email or password.` (để không lộ email nào tồn tại) và tăng bộ đếm sai.
4. Đúng → xoá bộ đếm, trả user (không kèm `password_hash`).

Bộ đếm sai là `Map` trong RAM: mất khi restart, và chỉ có tác dụng với một tiến trình.

**`promoteIfListed(user)`:** bước cuối cho mọi user trả về client. Nếu email nằm trong `ADMIN_EMAILS` mà `role` chưa phải admin thì `UPDATE users SET role='admin'` (không bao giờ tự hạ quyền ai). Rồi tính `premium = role==='admin' || plan==='premium'`.

**Google (`verifyGoogleCredential`, `upsertGoogleUser`):**
- Không có `GOOGLE_CLIENT_ID` → lỗi validation.
- `OAuth2Client.verifyIdToken({ idToken, audience })` kiểm tra chữ ký, hạn và audience. Yêu cầu có `sub`, `email` và `email_verified !== false`; mọi lỗi trả chung `Google sign-in could not be verified.`
- `upsertGoogleUser`: tìm theo `google_sub`; nếu chưa có thì nối vào tài khoản **cùng email** (vì Google đã xác minh email); nếu vẫn chưa có thì tạo mới (không có mật khẩu).

**Cookie phiên (không có bảng sessions):**
- Giá trị: `userId.hạn.chữ_ký`, với `chữ_ký = HMAC-SHA256(sessionSecret, "userId.hạn")`.
- `createSessionToken`: hạn = bây giờ + 7 ngày.
- `readSessionToken`: tách 3 phần, tính lại chữ ký, so `timingSafeEqual` (kiểm tra độ dài trước), kiểm tra hạn; trả `userId` hoặc `null`.
- `readCookie`: tự đọc header `Cookie` (không dùng thư viện cookie-parser).
- `currentUser(req)`: đọc cookie → `getUserById` → `promoteIfListed`. **User luôn được đọc lại từ DB ở mỗi request**, nên đổi role/plan có hiệu lực ngay.
- Hệ quả: đăng xuất chỉ xoá cookie ở trình duyệt; token cũ vẫn hợp lệ đến khi hết hạn. Đổi `SESSION_SECRET` sẽ vô hiệu hoá mọi phiên.

### 5.7. `routes/auth.routes.js`

| Method | Đường dẫn | Việc làm |
|---|---|---|
| GET | `/auth/config` | Trả `googleClientId` (hoặc `null`) để frontend quyết định có vẽ nút Google không |
| GET | `/auth/me` | Trả `currentUser(req)` (hoặc `null`) |
| POST | `/auth/register` | Đăng ký, đặt cookie, trả 201 |
| POST | `/auth/login` | Đăng nhập; truyền `req.ip` cho bộ đếm sai |
| POST | `/auth/google` | Đổi ID token lấy cookie phiên |
| POST | `/auth/logout` | `clearCookie`, trả `null` |

`startSession(res, user, status)` đặt cookie `hl_session` với `httpOnly: true` (JavaScript trong trang không đọc được), `sameSite: 'lax'` (không gửi cookie trong POST từ trang khác), `secure: config.isProduction`, `path: '/'`, `maxAge` 7 ngày.

### 5.8. `middleware/auth.middleware.js`: phân quyền

- `requireUser`: không có phiên → `throw ApiError.unauthorized()` (401); gắn `req.user`.
- `requireAdmin`: gọi `requireUser` rồi kiểm tra `role === 'admin'`, không đủ → 403.
- `guardPage(allow, onDenied)`: dùng cho **trang HTML**. Luôn đặt `Cache-Control: private, no-cache` để nút Back sau khi đăng xuất không hiện lại trang cũ từ cache.
  - `requireUserPage`: chưa đăng nhập → redirect `/login.html?next=<URL gốc>`.
  - `requireAdminPage`: chưa đăng nhập → login; đã đăng nhập nhưng không phải admin → về `/`.

Đây là nơi **server quyết định ai được vào**; JavaScript phía trình duyệt chỉ hiển thị trạng thái.

### 5.9. Thanh toán Premium giả lập: `services/billing.service.js`

Không có cổng thanh toán thật. Luồng:

```
Người dùng bấm Upgrade
  → POST /api/billing/orders         tạo đơn (code ngẫu nhiên 96 bit, hạn 10 phút), hoặc dùng lại đơn pending còn hạn
  → trang hiện QR trỏ tới  <baseUrl>/pay.html?order=<code>
  → điện thoại quét QR, pay.html gọi POST /api/billing/pay/<code>
  → server: một TRANSACTION đánh dấu đơn paid + nâng users.plan='premium' + ghi payments
  → upgrade.html hỏi lại GET /orders/<code> mỗi 2 giây, thấy paid thì tự vẽ lại header
```

Điểm đáng chú ý:
- `code = randomBytes(12).toString('hex')` (96 bit) là bí mật nằm trong URL QR, nên `pay.html` **không cần đăng nhập** (giống quét mã bằng điện thoại khác).
- Trạng thái `expired` được **tính khi đọc** (`status === 'pending' && expires_at < Date.now()`), nên không cần tác vụ nền.
- `getOwnOrder` trả 404 (không phải 403) nếu đơn của người khác, để không lộ đơn tồn tại.
- `payOrder` an toàn khi gọi nhiều lần (đã `paid` thì trả luôn). Dùng `BEGIN/COMMIT/ROLLBACK` để ba thao tác ghi cùng thành công hoặc cùng huỷ.
- `baseUrl(req)`: nếu có `PUBLIC_URL` thì dùng; nếu đang truy cập qua `localhost` thì thay bằng **IP mạng LAN** của máy, vì điện thoại không mở được `localhost` của máy tính.
- Giá cố định `PREMIUM_PRICE_VND = 5000`.
- `createOrder` từ chối nếu `user.premium` đã đúng (409).

### 5.10. Quản trị: `routes/admin.routes.js` và `services/admin.service.js`

`adminRouter.use(requireAdmin)` bảo vệ **toàn bộ** router.

**Người dùng:**
- `GET /admin/users`: danh sách kèm `hasPassword`, `hasGoogle` (suy ra từ `IS NOT NULL`, không lộ hash).
- `PATCH /admin/users/:id` với `{ role?, plan? }`: đổi gói (cho phép với chính mình) và/hoặc đổi quyền.
- `DELETE /admin/users/:id`.
- `requireOtherUser`: **không cho admin đổi quyền hoặc xoá chính mình**, tránh vô tình mất quyền quản trị.

**Món và địa điểm:**
- `validateSpot(body, kind)` kiểm tra từng trường (`text()` và `number()` có `required`, `max`, `min`, `integer`). Trường chỉ dành cho loại kia được đặt `null`. `image` phải bắt đầu bằng `/` hoặc `https://`.
- `createSpot`: sinh `id` bằng `slugify` (bỏ dấu tiếng Việt qua `normalize('NFD')`, đổi `đ`→`d`) cộng tiền tố `food-`/`place-`; trùng thì thêm `-2`, `-3`.
- `updateSpot`: **không đổi được `kind`** sau khi tạo (vì id, ảnh và quán đi kèm theo loại).
- Quán của từng món nằm trong `food-venues.js` nên **không sửa được từ trang admin**.

### 5.11. `middleware/image-resolver.middleware.js`: ảnh không có đuôi

Dữ liệu lưu `image_url` dạng `/assets/images/spots/food-pho-bo` (không có đuôi). Middleware:
1. Chỉ xử lý `GET/HEAD` và đường dẫn bắt đầu bằng `/assets/images/` **không có phần mở rộng**; còn lại nhường cho `express.static`.
2. `path.posix.normalize` và loại bỏ `..` (chống đọc file ngoài thư mục ảnh).
3. Thử lần lượt `.avif`, `.webp`, `.jpg`, `.jpeg`, `.png`, lấy file đầu tiên tồn tại (thứ tự **cố định**, không đọc `Accept` của trình duyệt, không so dung lượng).
4. Không có file nào → trả `placeholder.svg` kèm header `X-Image-Placeholder: true`.
5. Production: cache kết quả tìm file trong RAM và đặt `maxAge` 30 ngày; development không cache để thấy ảnh mới ngay.

### 5.12. Dữ liệu trong mã nguồn

- `data/food-venues.js`: `FOOD_VENUES` (đóng băng bằng `Object.freeze`) ánh xạ `id món → [quán]`. Mỗi quán có `id, name, address, district, lat, lng`. Tọa độ **làm tròn**, chỉ dùng để xếp gần/xa tương đối.
- `data/group-food.js`: `GROUP_FOOD`, 4 món nhóm biên soạn thêm (mô tả ngắn, không tự đặt rating hay giờ mở cửa).
- `database/seed-data.js`: `FOOD` (10 món), `GROUP_FOOD` (4 món), `PLACES` (10 địa điểm); `spots` ghép tất cả thành một mảng, gán `kind`, `image = /assets/images/spots/<id>`.

**Lưu ý số liệu:** `seed-data.js` có thể tạo tới **14 món**, nhưng database trên máy chỉ có **10 món** nếu chưa chạy `scripts/import-group-food.mjs` (script này chỉ thêm món chưa có, không ghi đè).

---

## 6. Cơ sở dữ liệu

### 6.1. `database/connection.js`

- `getDb()` là **singleton lười**: lần đầu tạo thư mục chứa file, mở `DatabaseSync`, chạy `PRAGMA foreign_keys = ON` (SQLite mặc định tắt khoá ngoại; cần cho `ON DELETE CASCADE`) và `PRAGMA journal_mode = WAL` (đọc/ghi ít khoá nhau; sinh thêm file `-wal`, `-shm`). Các lần sau trả lại đúng kết nối đó.
- `toPlain(row)`: hàng của `node:sqlite` có prototype `null`, hàm này sao chép thành object thường để dùng spread/JSON.
- `closeDb()`: đóng kết nối, xoá tham chiếu để `getDb()` sau mở lại.

`DatabaseSync` chạy **đồng bộ**: mỗi truy vấn chặn event loop đến khi xong. Với SQLite cục bộ và dữ liệu nhỏ thì chấp nhận được.

### 6.2. `database/schema.sql`: bốn bảng

| Bảng | Cột chính | Ràng buộc nổi bật |
|---|---|---|
| `spots` | `id` (TEXT, khoá chính), `kind`, `name`, `short_description`, `description`, `category`, `district`, `price_level`, `admission`, `rating`, `duration_minutes`, `image_url`, `lat`, `lng`, `address`, `opening_hours`, `local_tip`, `featured` | `CHECK kind IN ('food','place')`; `price_level 1–3`; `admission ≥ 0`; `rating 0–5`; `lat/lng` trong miền hợp lệ; chỉ mục `idx_spots_kind`, `idx_spots_featured` |
| `users` | `id`, `google_sub` (UNIQUE), `email` (UNIQUE, NOCASE), `name`, `picture`, `password_hash`, `role`, `plan`, `created_at` | `role IN ('user','admin')`; `plan IN ('free','premium')`; `password_hash` rỗng nghĩa là chỉ dùng Google |
| `payments` | `user_id` → `users` (CASCADE), `amount_vnd ≥ 0`, `method`, `created_at` | Sổ ghi nâng cấp (`method = 'qr-demo'`) |
| `payment_orders` | `user_id` → `users` (CASCADE), `code` (UNIQUE), `amount_vnd`, `status` (`pending`/`paid`), `expires_at` (mili giây epoch), `paid_at` | Hạn lưu dạng số để so với `Date.now()` |

Các `CHECK` đặt ràng buộc **ngay tại database**, nên dữ liệu sai bị từ chối kể cả khi code validate bị lọt.

### 6.3. `database/initialize.js`: khởi tạo và di chuyển

`initDatabase({ fresh })`:
1. Nếu `fresh`: `closeDb()` rồi xoá file DB cùng `-journal`, `-wal`, `-shm`.
2. `renameLegacyUsers`: nếu bảng `users` cũ chưa có `password_hash` (bản đầu chỉ Google, `google_sub NOT NULL`) thì đổi tên thành `users_legacy` (SQLite không đổi được ràng buộc cột).
3. `db.exec(schema.sql)` (toàn bộ là `CREATE ... IF NOT EXISTS`, chạy lại an toàn).
4. `copyLegacyUsers`: chép dữ liệu từ `users_legacy` sang bảng mới rồi `DROP`.
5. `addMissingColumns`: thêm `lat`, `lng` (cho `spots`) và `plan` (cho `users`) nếu DB cũ chưa có, vì `CREATE TABLE IF NOT EXISTS` không thêm cột vào bảng đã tồn tại.

Khi chạy trực tiếp với `--fresh`, `assertServerNotRunning()` gọi `/api/health`: nếu server còn chạy thì **từ chối xoá** (tránh server ghi vào file đã bị xoá).

### 6.4. `database/seed.js`

- Câu `INSERT ... ON CONFLICT (id) DO UPDATE SET ...` (upsert) với tham số đặt tên (`:id`, `:name`...): chạy lại seed **cập nhật** thay vì nhân đôi.
- `toRow` ánh xạ `camelCase` → cột SQL, trường thiếu thành `null`.
- Toàn bộ nằm trong `BEGIN ... COMMIT`; lỗi giữa chừng thì `ROLLBACK`, nên lần nạp hoặc thành công trọn vẹn hoặc không đổi gì.
- `seedDatabase(records)` nhận tập con để bổ sung mà không ghi đè phần còn lại.

---

## 7. Frontend: nền tảng dùng chung

### 7.1. Thứ tự nạp trong mỗi trang HTML

CSS: `fonts.css` → `tokens.css` → `base.css` → CSS riêng (`guide.css`, `plan.css`, `pages.css`...). Quy tắc nạp sau có thể ghi đè quy tắc nạp trước. JavaScript: `<script type="module" src="/scripts/pages/xxx.page.js">`. `type="module"` cho phép `import`, chạy sau khi HTML được phân tích, và hỗ trợ **top-level `await`** (các trang dùng `await loadSpots()` ngay ở cấp file).

Trang Home `preload` hai font WOFF2 để tránh nhấp nháy chữ.

### 7.2. CSS

| File | Vai trò |
|---|---|
| `tokens.css` | Biến thiết kế trong `:root`: màu cơ bản, màu theo vai trò (`--bg-page`, `--text-primary`, `--accent-action`...), cỡ chữ (`clamp`), khoảng cách, bo góc, bóng |
| `base.css` | Reset, kiểu tiêu đề/link/ảnh/form, viền `:focus-visible`, lớp `.skip-link`, khung `.container`, khu vực tài khoản ở header; có quy tắc để thuộc tính `hidden` thắng `display` của component |
| `guide.css` | Giao diện Food/Places và lịch, header dính (`position: sticky`) |
| `plan.css` | Trang Plan: ô cấu hình, tab ngày, form thêm điểm, timeline, thông báo, thư viện, kéo-thả, và `@media print` cho bản in |
| `pages.css`, `home-components.css` | Trang chủ |
| `account.css`, `upgrade.css`, `admin.css` | Đăng nhập, nâng cấp, quản trị |

Grid dùng để chia cột, Flex để xếp nhóm nút, `var(--...)` để dùng lại giá trị. Giao diện thiết kế cho **desktop** (không hỗ trợ điện thoại).

### 7.3. `shared/ui.js`: tạo DOM an toàn

- `el(tag, className, text)`: `document.createElement`, gán chữ bằng `textContent` (**không bao giờ `innerHTML`**), nên dữ liệu từ API hay từ người dùng không bị hiểu thành HTML (chống XSS).
- `link(text, href, className)`: nếu `href` bắt đầu bằng `https://` thì thêm `target="_blank"` và `rel="noopener noreferrer"` (trang đích không truy cập được `window.opener`).
- `picture(src, alt, className)`: dù tên là "picture", hàm này trả về thẻ **`<img>`** (không phải thẻ HTML `<picture>`), có `loading="lazy"` và `width=900`/`height=675` để giữ chỗ, tránh dịch bố cục khi ảnh tải xong.

### 7.4. `shared/auth.js`: tài khoản ở trình duyệt

- `authApi(path, {method, body})`: `fetch('/api/auth/<path>')` với `credentials: 'same-origin'`; lỗi thì ném `Error(message của server)`.
- `safeNext(value)`: chỉ nhận đường dẫn **nội bộ** (`/...`), chặn `//evil.com`, `/\` và `https://...` để tránh chuyển hướng ra ngoài sau đăng nhập (open redirect).
- `mountGoogleButton`: lấy `googleClientId`; nếu không có thì không vẽ gì. Nạp script Google Identity Services động (`loadGoogleScript`), khởi tạo, vẽ nút; khi có `credential` thì `POST /auth/google`.
- `initAuth()`: gắn khu vực tài khoản vào cuối `.site-header__inner`, gọi `GET /auth/me`; có user thì `renderUser` (avatar, tên, huy hiệu Premium, link Admin nếu admin, nút Upgrade nếu chưa premium, nút Sign out), chưa có thì `renderGuest` (Sign in / Create account kèm `?next=`). Trả về user hoặc `null`. API lỗi thì bỏ qua, không chặn trang.
- Sign out: gọi `/auth/logout`, `disableAutoSelect()` của Google; nếu đang ở trang cần đăng nhập thì về `/`.

**Quan trọng:** đây chỉ là phần hiển thị. Việc chặn truy cập là ở server (`5.8`).

### 7.5. `shared/guide.js`: mô hình chuyến đi và tiện ích

**Hằng số:** `ORIGINS` (4 mốc xuất phát: Hoan Kiem Lake, Old Quarter, Temple of Literature, West Lake, mỗi mốc có tọa độ), `MAX_DAYS = 30`, `MAX_STOPS_PER_DAY = 8`, `TOURS` (3 tour mẫu: `old-quarter`, `heritage`, `slow-day`). Mỗi tour chỉ có `pattern`, tức danh sách bước `{kind, slot, prefer}`; điểm cụ thể do `buildTourStops` chọn.

**Tải danh mục:** `loadSpots()` = `fetch('/api/spots')` rồi lấy `payload.data`.

**localStorage:** hai khoá `hanoi-local-trip-v2` (lịch) và `hanoi-local-favorite-dishes-v2` (món yêu thích).
- `readFavorites`/`toggleFavorite`: dùng `Set` để mỗi món chỉ xuất hiện một lần.
- `readTrip` luôn bọc `JSON.parse` trong `try/catch` và chạy qua `normalizeTrip`, nên dữ liệu hỏng không làm sập trang.

**`normalizeTrip(saved)`** là "cổng làm sạch" duy nhất: nhận dữ liệu bất kỳ (localStorage, link chia sẻ, bản lưu) và trả về lịch hợp lệ.
- `dayCount` trong 1..30, `startDate` đúng dạng `YYYY-MM-DD`, `originId` thuộc `ORIGINS`.
- `days` có độ dài ít nhất `dayCount`; mỗi ngày lọc `isValidStop`, cắt còn tối đa 8 điểm, rồi `cleanStop` (giữ trường hợp lệ: `startTime` 0..1439, `duration` 15..480; điểm tự nhập cắt tên 80 và địa chỉ 120 ký tự).
- Sai dạng hoàn toàn → lịch mặc định (1 ngày trống, xuất phát Hồ Hoàn Kiếm).

**Ngày:** `addDays`, `daysBetween` tính theo **UTC** (`Date.UTC`, 86 400 000 ms/ngày) để không lệch vì giờ mùa hè. `dateForDay` định dạng nhãn tab ("Monday, 5 Oct") bằng `Intl.DateTimeFormat('en-GB')`.

**Mốc xuất phát:** `originFor(trip, index)` ưu tiên mốc riêng của ngày, rồi mốc chung của chuyến, cuối cùng `ORIGINS[0]`.

**Khoảng cách:** `approxKm(a, b)` là **công thức Haversine** (khoảng cách đường chim bay trên mặt cầu bán kính 6371 km). `sortedVenues(food, origin)` sao chép mảng rồi sắp theo `approxKm` tăng dần (không làm đổi dữ liệu gốc).

**URL Google Maps (không cần API key):**
- `mapsSearch(name, address)`: tìm theo tên và địa chỉ.
- `mapsDirections(origin, name, address)`: chỉ đường đi bộ (`travelmode=walking`).
- `mapsRoute(origin, stops)`: một tuyến cho cả ngày, điểm cuối là `destination`, các điểm trước là `waypoints` nối bằng `|`.
- `encodeURIComponent` giữ ký tự tiếng Việt an toàn trong URL.

**`spotPoint(spot, venue)`:** món dùng tọa độ quán đã chọn; địa điểm dùng `lat/lng` của nó; thiếu thì dùng mốc `ORIGINS[0]`.

**Các hàm thao tác lịch:** `pruneTrip` (bỏ điểm trỏ tới món/địa điểm không còn trong danh mục, trả số điểm đã bỏ), `dayUsingSpot` (ngày nào đã chứa điểm này), `ensureDays` (kéo dài `trip.days`).

### 7.6. `shared/tours.js`: dựng tour theo quy tắc (không phải AI)

`buildTourStops(tour, { origin, spots, usedIds, getPoint })` đi qua từng bước của `pattern`:

1. Lọc ứng viên cùng `kind`, chưa chọn trong tour này, và (lượt đầu) chưa dùng ở ngày khác.
2. Với món: chọn **quán gần điểm trước nhất** (`nearestVenue`); món không có quán bị loại.
3. Tính điểm: `score = khoảng cách (km) + 1 nếu ngoài nhóm ưu tiên + 100 nếu đã dùng ở ngày khác`. **Điểm thấp được chọn**.
4. Chọn ứng viên điểm thấp nhất, ghi lại, và dùng chính nó làm "điểm trước" cho bước sau (nên các điểm nối nhau theo chuỗi gần).

Hằng số: `OFF_THEME_KM = 1` (chủ đề chỉ ưu tiên **nhẹ**: lệch chủ đề chỉ bị phạt như đi xa thêm 1 km), `USED_PENALTY_KM = 100` (điểm đã dùng chỉ được chọn khi hết điểm mới).

Lượt đầu (`build(false)`) không cho dùng lại điểm ở ngày khác; nếu không đủ số bước thì dựng lại (`build(true)`) cho phép tái dùng. Kết quả: mỗi ngày một khác khi còn điểm mới.

### 7.7. `shared/library.js`: kho cá nhân

Hai khoá `hanoi-local-saved-plans-v1` và `hanoi-local-custom-tours-v1`; tối đa **10** lịch có tên và **10** tour; tên tối đa 40 ký tự. Mọi hàm nhận `storage` làm tham số (mặc định `localStorage`) để test bằng đối tượng giả.

- `savePlan(name, trip, storage, now, maxPlans)`: trùng tên (không phân biệt hoa thường) thì **ghi đè**; vượt giới hạn thì trả `{ error }`. Lưu **bản sao sâu** (`JSON.parse(JSON.stringify(trip))`) đã qua `normalizeTrip`.
- `addCustomTour(title, stops)`: tour chỉ lưu `kind, spotId, slot` (và tên/địa chỉ với điểm tự nhập); quán và giờ được **tính lại** khi dùng.
- `readSavedPlans`/`readCustomTours` luôn lọc và chuẩn hoá, dữ liệu hỏng trả mảng rỗng.

### 7.8. `shared/share.js`: chia sẻ không cần server

```
trip (chỉ các ngày đang hiển thị)
  → JSON.stringify → TextEncoder (UTF-8) → btoa → thay + / = để thành base64url
  → đặt vào phần hash:  https://.../plan.html#plan=<chuỗi>
```

- Hash (`#...`) **không bao giờ được gửi lên server**, nên lịch không đi qua backend.
- `decodeTrip` kiểm tra độ dài ≤ 40 000, chỉ ký tự `A-Za-z0-9_-`, giải mã, chạy `normalizeTrip`, và trả `null` nếu lịch rỗng.
- Base64url chỉ là cách biểu diễn dữ liệu, **không phải mã hoá bảo mật**: ai có link đều đọc được lịch.
- `shareUrl` xoá query cũ (như `?tour=`) để mở link chỉ áp dụng lịch đã chia sẻ.

### 7.9. `shared/calendar.js`: xuất `.ics`

`buildIcs(days, {now, mapsLink})` tạo một `VCALENDAR`, mỗi điểm dừng là một `VEVENT` (`UID`, `DTSTAMP`, `DTSTART`, `DTEND`, `SUMMARY`, `LOCATION`, `DESCRIPTION` gồm khung giờ, mẹo, link chỉ đường, cảnh báo).
- `icsLocalTime`: ghép ngày + số phút thành `YYYYMMDDTHHMMSS` (qua `Date.UTC`, cho phép phút > 1440).
- `escapeIcsText`: thoát `\`, `;`, `,` và xuống dòng.
- `foldLine`: cắt dòng dài hơn **75 byte UTF-8** theo RFC 5545 (dòng tiếp theo bắt đầu bằng dấu cách), đếm theo byte để không cắt giữa ký tự tiếng Việt.
- Giờ xuất là **"floating"** (không gắn múi giờ): lịch điện thoại hiển thị đúng giờ trên mặt đồng hồ, không tự đổi sang `Asia/Ho_Chi_Minh`.

### 7.10. `shared/plan-controls.js`

- `createPicker(root)`: điều khiển các tab chọn loại điểm (Tours / Food / Places / Own stop): đổi `aria-selected`, `tabIndex`, ẩn/hiện panel, hỗ trợ phím mũi tên trái/phải, Home, End.
- `createConfirmation(dialog)`: bọc phần tử `<dialog>`; `showModal()` lo focus, Tab và Escape; hàm hành động chỉ chạy khi `returnValue === 'confirm'`.

---

## 8. Frontend: thuật toán lập lịch (`schedule.js`)

Đây là phần "trí tuệ" của website. Toàn bộ là **hàm thuần**, giờ được biểu diễn bằng **số phút từ 00:00** (08:30 = 510) để cộng trừ dễ dàng.

### 8.1. Hằng số

| Hằng số | Giá trị | Ý nghĩa |
|---|---|---|
| `SLOT_START` | sáng 08:00, chiều 12:00, tối 18:00 | Giờ bắt đầu mặc định của từng buổi |
| `DAY_END` | 22:00 | Quá giờ này thì cảnh báo |
| `FOOD_MINUTES` | 50 | Thời gian ăn mặc định |
| `DEFAULT_VISIT_MINUTES` | 60 | Địa điểm thiếu `durationMinutes`; điểm tự nhập cũng 60 |
| `ROAD_FACTOR` | 1.3 | Đường thật dài hơn đường chim bay |
| `WALK_LIMIT_KM` | 1.5 | Đoạn ngắn hơn thì tính đi bộ |
| `CUSTOM_TRAVEL_MINUTES` | 15 | Điểm tự nhập không có tọa độ nên chỉ ước lượng |
| `LATE_WARNING_MINUTES` | 45 | Điểm đầu buổi trễ từ 45 phút mới cảnh báo |
| `MIN_DURATION`/`MAX_DURATION` | 15 / 480 | Giới hạn thời lượng một điểm |

### 8.2. `orderStops`, `slotForTime`, `defaultDuration`, `formatTime`

- `orderStops(stops)`: thứ tự hiển thị = **theo buổi** (sáng, chiều, tối), cùng buổi thì theo **thứ tự thêm vào** (`originalIndex`). Trả về `[{ stop, originalIndex }]`.
- `slotForTime(minutes)`: buổi muộn nhất có giờ bắt đầu không sau giờ đó (ví dụ 12:30 → afternoon).
- `defaultDuration(spot)`: món 50 phút; địa điểm dùng `durationMinutes` hoặc 60.

### 8.3. `travelMinutes(km)`

```
road = km × 1.3
nếu road ≤ 1.5 km:  phút = road / 5 × 60         (đi bộ 5 km/h)
ngược lại:          phút = 8 + road / 18 × 60     (xe ~18 km/h, cộng 8 phút chờ/lên xe)
kết quả = max(10, làm tròn LÊN bội số của 5)
```

### 8.4. `scheduleDay({ stops, origin, dateText, getSpot, getVenue, getPoint })`

Duyệt các điểm theo `orderStops`, giữ hai biến: `cursor` (giờ rời điểm trước) và `previous` (vị trí trước, để tính khoảng cách). Với mỗi điểm:

1. Lấy `spot` (điểm tự nhập dùng `customSpot` tối giản), `venue` (chỉ với món), `point` (tọa độ). Điểm tự nhập dùng vị trí của điểm trước (`km = 0`).
2. `travel` = 0 nếu là điểm đầu; ngược lại `CUSTOM_TRAVEL_MINUTES` cho điểm tự nhập hoặc `travelMinutes(km)`.
3. `earliest = cursor + travel` (hoặc 0 nếu là điểm đầu).
4. **Giờ bắt đầu:** nếu điểm có `startTime` (đã "ghim") thì **giữ đúng giờ đó**; không thì `max(SLOT_START[slot], earliest)`.
5. `duration` = `stop.duration` nếu có, không thì mặc định; `end = start + duration`.
6. **Cảnh báo** (chỉ thông tin, **không** tự đổi giờ khách đã ghim):
   - Giờ mở cửa: `openingWarning(...)`.
   - **Trùng giờ**: điểm ghim có `start < cursor` → thêm cảnh báo "Overlaps the previous stop...", đặt cờ `overlap = true` cho **cả điểm này và điểm liền trước**.
   - Không đủ thời gian di chuyển: điểm ghim có `start < earliest` (nhưng không trùng) → "Not enough time to reach this stop...".
   - Trễ buổi: điểm tự động đầu buổi bắt đầu muộn từ 45 phút so với đầu buổi vì các điểm trước kéo dài.
   - Quá `DAY_END`.
7. Đẩy item `{ stop, originalIndex, spot, venue, point, name, address, previous, km, travelMinutes, start, end, duration, warnings, pinned, overlap, noCoords, customDuration }`, rồi `cursor = end`, `previous = point`.

Cuối cùng trả `{ items, summary }`, với `summary` gồm số điểm, giờ đầu/cuối, tổng km, tổng phút di chuyển, tổng vé tham quan (chỉ cộng `admission`, không gồm tiền ăn/đi lại) và số cảnh báo.

**Ví dụ:** điểm đầu 08:00, ở 50 phút (kết thúc 08:50), đi tới điểm sau mất 15 phút → điểm sau bắt đầu `max(08:00, 08:50 + 15) = 09:05`.

### 8.5. `openingWarning(hours, dateText, start, finish)`

Đọc chuỗi giờ mở cửa dạng văn bản: các khoảng `HH:MM - HH:MM` (nhiều khoảng cách nhau dấu phẩy), `closed Monday`, `closed Monday and Friday afternoon`, `open all day`, khoảng qua nửa đêm (nếu `close <= open` thì cộng 24 giờ). Lấy thứ trong tuần của `dateText` (giữa trưa để tránh lệch múi giờ). Trả chuỗi cảnh báo hoặc `''`. Đây là dữ liệu **tham khảo** trong danh mục, không phải giờ thực tế của từng quán.

### 8.6. Sắp xếp và đổi vị trí

- **`moveStop(stops, originalIndex, ±1)`**: hoán đổi với điểm kề trong **thứ tự hiển thị**; khi vượt ranh giới buổi, điểm di chuyển nhận **buổi của điểm bị hoán đổi**. Trả mảng mới (mảng cũ không đổi); ra ngoài biên thì trả đúng `stops` cũ. Dùng cho phím mũi tên trên tay nắm.
- **`moveStopTo(stops, fromIndex, toIndex, after)`**: dùng cho **kéo-thả**: đưa điểm `from` lên trước (hoặc sau, nếu `after`) điểm `to`. Điều chỉnh vị trí chèn khi `from < position`, nhận buổi của điểm đích, trả `stops` cũ nếu vị trí không đổi.
- **`insertStopByTime(stops, stop, items)`**: chèn điểm có `startTime` **trước điểm đầu tiên bắt đầu muộn hơn nó** (theo `items` đã tính).
- **`settleOrder(stops, schedule)`**: giải quyết vấn đề điểm tự động bị đẩy lùi qua điểm ghim giờ. Lặp tối đa `n` lượt: tính `items`, sắp theo `start` (ổn định), nếu thứ tự đổi thì dựng lại danh sách và đổi buổi của điểm bị dời theo `slotForTime(start)`, rồi tính lại đến khi ổn định. Nếu số `items` khác số `stops` (có điểm không còn trong danh mục) thì **không đụng vào**.
- **`optimizeOrder(stops, {...})`**: "đi tới điểm gần nhất" (nearest-neighbor) **trong từng buổi**: bắt đầu từ mốc xuất phát, mỗi vòng chọn điểm chưa dùng gần nhất, rồi dùng nó làm điểm xuất phát tiếp theo; buổi sau nối từ điểm cuối của buổi trước. Điểm đã **ghim giờ** hoặc **không có tọa độ** giữ nguyên vị trí; không đổi buổi của điểm nào. Đây là heuristic, **không bảo đảm quãng đường ngắn nhất**.

### 8.7. `suggestNearby(...)`: gợi ý điểm kế tiếp

Trả tối đa 3 gợi ý gần điểm cuối của ngày (hoặc gần mốc xuất phát nếu ngày trống). Với mỗi ứng viên chưa có trong ngày: tính quán gần nhất (nếu là món), `earliest = last.end + travelMinutes(km)`, chọn buổi (không sớm hơn buổi của điểm cuối), tính `start`/`end`. **Loại** ứng viên kết thúc sau 22:00 hoặc vi phạm giờ mở cửa. Sắp xếp: điểm **chưa dùng ở ngày nào** trước, điểm đã có ở ngày khác chỉ để lấp chỗ; sau đó theo khoảng cách. Ngày đã đủ 8 điểm thì không gợi ý.

---

## 9. Frontend: các trang

### 9.1. Home: `index.html` và `home.page.js`

- `initAuth()` vẽ khu vực tài khoản.
- Dựng ba thẻ tour từ `TOURS` (link `/plan.html?tour=<id>`) **trước** khi gọi API, nên phần này hiện ngay.
- Rồi `loadSpots()`, lấy 4 món và 3 địa điểm đầu tiên (thứ tự API đã đưa mục nổi bật lên trước), dựng thẻ bằng `feature()`; link kèm hash `#<id>` để trang đích cuộn tới đúng mục.
- Lỗi API: hiện thông báo lỗi trong các lưới.

### 9.2. Food: `food.page.js`

- Tải danh mục **một lần**; tìm kiếm sau đó lọc mảng `foods` trong bộ nhớ (`toLocaleLowerCase('vi')` để so sánh không phân biệt hoa thường theo tiếng Việt).
- Select mốc xuất phát được khởi tạo từ `readTrip().originId`; đổi mốc thì **ghi lại vào lịch** (`saveTrip`) để Food và Plan dùng chung lựa chọn.
- Mỗi thẻ món: ảnh minh hoạ (ghi chú rõ không phải ảnh của quán), nút yêu thích (`toggleFavorite`, cập nhật nhãn và `aria-pressed` tại chỗ), danh sách quán xếp gần trước (`sortedVenues`), mỗi quán có khoảng cách ước tính, link **Directions** (`mapsDirections`) và **Add to plan** (`/plan.html?food=<id>&venue=<id>`).
- Có hash `#id` thì cuộn tới món đó sau khi dựng.

### 9.3. Places: `places.page.js`

Lọc `kind === 'place'`; tìm trong `tên + nhóm + quận`; mỗi thẻ hiện quận, số phút tham quan, vé (`Free entry` hoặc số tiền định dạng `toLocaleString('en-US')`), link **View on Maps** và **Add to plan** (`/plan.html?place=<id>`).

### 9.4. Login: `login.page.js`

Hai form (đăng nhập, tạo tài khoản) và nút Google dùng chung một vùng báo lỗi. `handleForm` gửi form tới API (khoá nút trong lúc chờ để tránh gửi hai lần), thành công thì `location.assign(next)` với `next = safeNext(?next)`. Nếu đã đăng nhập (`initAuth()` trả user) thì chuyển đi ngay. Tham số `?mode=register` mở sẵn tab đăng ký; nếu `next` bắt đầu bằng `/plan` thì hiện ghi chú "Sign in or create a free account to use Plan your day".

### 9.5. Upgrade và Pay: `upgrade.page.js`, `pay.page.js`

- **Upgrade:** chưa đăng nhập → nút "Sign in to upgrade"; đã premium → thông báo gói hiện tại; còn lại → nút nâng cấp. `startCheckout` gọi `POST /billing/orders`, hiện QR (`/api/billing/orders/<code>/qr.svg`), giá, mã tham chiếu `memo`, đồng hồ đếm ngược, và `setInterval(poll, 2000)` hỏi trạng thái đơn. Khi `paid`: dừng timer, hiện thông báo thành công, vẽ lại header để thấy huy hiệu Premium. Khi `expired`: hiện nút tạo QR mới. **Server là nơi nâng gói; trang chỉ hiển thị.**
- **Pay:** đọc `?order=`, `GET /billing/pay/<code>` hiện số tiền và mã tham chiếu, nút xác nhận gọi `POST`.

### 9.6. Admin: `admin.page.js`

- Gọi `initAuth()`; không phải admin thì `location.assign('/')` (và server cũng đã chặn ở `requireAdminPage`).
- Hai tab (Places & food / Users) và một form thêm/sửa dùng chung. `api()` gọi `/api/admin/*`; mã 401/403 thì chuyển về `/`.
- `run(action, successText)`: chạy thao tác và hiện kết quả/lỗi ở dòng trạng thái, thay vì làm vỡ trang.
- `openForm(spot)`: điền form từ đối tượng (bỏ `venues`), khoá ô `kind` khi sửa. `syncKindFields` ẩn/hiện các ô riêng theo loại. `formBody()` đọc form thành JSON (bỏ các ô trong phần đang ẩn).
- Bảng người dùng: nút đổi gói (`Give/Remove Premium`), đổi quyền (`Make/Remove admin`), `Delete`; **không hiện nút nguy hiểm với chính mình**. Xoá dùng `confirm()` của trình duyệt.

---

## 10. Trang Plan chi tiết (`plan.page.js`)

File dài nhất (khoảng 1000 dòng); đọc theo thứ tự trong chú thích đầu file: **trạng thái → hàm render → sự kiện → khối khởi tạo cuối file**.

### 10.1. Khởi động và giới hạn gói

```js
const premium = Boolean((await initAuth())?.premium);
const FREE_MAX_DAYS = 3;  const FREE_MAX_SAVED_PLANS = 1;
const maxDays = premium ? MAX_DAYS : FREE_MAX_DAYS;
```

- Gói **free**: tối đa **3 ngày** và **1 lịch có tên**; chia sẻ link, xuất `.ics` và in **chỉ dành cho Premium** (hàm `premiumOnly` gắn nhãn "(Premium)" và chỉ hiện lời nhắc nâng cấp khi bấm).
- **Các giới hạn này chỉ được áp dụng ở trình duyệt**, vì lịch lưu trong `localStorage`. Người dùng rành kỹ thuật có thể vượt qua; đây là rào cản trải nghiệm chứ không phải kiểm soát an toàn (xem mục 14.3).
- Người dùng free thấy dòng mời nâng cấp ở đầu trang.

### 10.2. Trạng thái

| Biến | Ý nghĩa |
|---|---|
| `trip` | **Nguồn dữ liệu chính** của lịch (đọc từ `readTrip()`), xem mục 11 |
| `activeDay` | Ngày đang xem, bắt đầu từ 0 |
| `spots`, `byId` | Danh mục và `Map` tra theo id (nhanh hơn tìm trong mảng nhiều lần) |
| `openAdjust` | `Set` các điểm có ô "Details & edit" đang mở, giữ qua lần render lại |
| `pendingFocus`, `highlightId` | Điều khiển focus bàn phím và tô điểm vừa thêm |
| `storageWarning` | Cảnh báo khi không ghi được `localStorage` |
| `ui` | Đối tượng gom các phần tử HTML theo `id` |

### 10.3. Mẫu "cập nhật dữ liệu → lưu → render lại"

Mọi thao tác theo cùng một khuôn:

```
1. (nếu cần hoàn tác) restore = snapshotDay(activeDay)
2. sửa trip.days[activeDay].stops
3. save()            → saveTrip(trip) vào localStorage (lỗi thì báo, không báo "đã lưu" giả)
4. render() hoặc renderTimeline()
5. message(text, restore)   → thông báo (có nút Undo nếu có restore), tự ẩn sau 5 giây
```

- `snapshotDay(day)` chụp **bản sao** các điểm của một ngày và trả về hàm khôi phục (cũng đặt lại `activeDay` và `dayCount` nếu cần).
- `message(text, undo)` dựng nội dung thông báo; **mỗi thông báo mới đặt lại bộ đếm 5 giây** (`clearTimeout` rồi `setTimeout`). Nút Undo cũng biến mất cùng thông báo.

### 10.4. Chuỗi render

```
render()
 ├─ settingsError(null,'')       xoá lỗi cấu hình
 ├─ renderDates()                ngày bắt đầu/kết thúc/số ngày, đặt min/max
 ├─ renderOrigins()              select mốc chung và mốc riêng của ngày
 ├─ renderVenues()               danh sách quán theo khoảng cách + xem trước
 ├─ renderPreview('place')
 ├─ renderTours()                tour mẫu + tour tự lưu, có xem trước chuỗi điểm
 ├─ renderSavedPlans()           danh sách lịch có tên
 └─ renderTimeline()             phần quan trọng nhất
      ├─ scheduleFor(activeDay)  → scheduleDay (mục 8)
      ├─ renderTabs()            tab ngày + phím mũi tên/Home/End
      ├─ renderSummary()         giờ, số điểm, km, vé, số cảnh báo
      ├─ renderRouteLink()       link Maps cả ngày
      ├─ renderPrintView()       bản in tất cả ngày
      ├─ renderNearby()          gợi ý (suggestNearby)
      └─ dựng từng hàng <li class="timeline-stop">
```

`scheduleFor(index)` là **cầu nối** giữa dữ liệu và thuật toán: truyền điểm của ngày, mốc xuất phát, ngày cụ thể và các hàm tra (`getSpot`, `getVenue = chooseVendor`, `getPoint = spotPoint`).

`chooseVendor(stop, origin)`: dùng quán đã lưu (`venueId`) nếu còn tồn tại; không thì chọn quán gần mốc xuất phát nhất.

### 10.5. Mỗi hàng điểm dừng

Hàng gồm: **tay nắm kéo "⠿"**, cột giờ (giờ đến, "to" giờ rời), nội dung (tên, quán/buổi, địa chỉ, khoảng cách, các cảnh báo), và các nút: link **Maps ↗** (từ điểm trước), ô **Details & edit**, **Remove**. Ô có `entry.overlap` được thêm class `timeline-stop--overlap` (nền đỏ nhạt, vạch đỏ bên trái, giờ màu đỏ).

**Details & edit (`adjustPanel`)** cho phép đổi quán (món ăn), **Start time**, **Time here (minutes)** và **Reset to automatic**.

### 10.6. Đặt giờ cụ thể: `placeTimed`

Dùng cho cả **thêm điểm có giờ** và **sửa Start time**. **Giữ đúng giờ khách chọn**, chỉ cảnh báo khi trùng:

```
placeTimed(stop, start, duration):
  others = scheduleFor(activeDay).items          (các điểm còn lại)
  clash  = điểm trong others có  start < item.end  VÀ  start + duration > item.start
  stop.startTime = start;  stop.slot = slotForTime(start)
  stops = insertStopByTime(stops, stop, others)  (chèn đúng chỗ theo giờ)
  stops = settleOrder(stops, schedule)           (xếp lại cả ngày theo giờ thực tế)
  trả về mô tả điểm bị trùng (hoặc '')
```

`settleOrder` cần thiết vì điểm **tự động** nối đuôi theo thứ tự trong danh sách và bị đẩy lùi; sau khi chèn một điểm ghim giờ, một điểm tự động có thể rơi **sau** điểm ghim dù thứ tự trong danh sách đứng trước. Thông báo ghi "Warning: this time overlaps X (08:00-09:30)" kèm Undo.

### 10.7. Thêm điểm: `addStop(spot, stop)`

Kiểm tra theo thứ tự: đủ 8 điểm/ngày → báo; điểm đã có trong ngày → báo; chụp `snapshotDay`; nếu có `startTime` thì `placeTimed`, không thì `push` vào cuối; `highlightId` để tô điểm vừa thêm; lưu; render; báo giờ bắt đầu thực tế, điểm đã có ở ngày khác (nếu có) và cảnh báo trùng giờ.

Ba form gọi `addStop`: món (`#add-food`), địa điểm (`#add-place`), điểm tự nhập (`#add-custom`, có tên bắt buộc, địa chỉ, giờ, thời lượng 15–480 phút; nếu chọn giờ thì ô "Part of day" bị khoá vì buổi suy ra từ giờ).

### 10.8. Kéo-thả đổi thứ tự

- `dragHandle(item, entry)` trả về nút tay nắm. `pointerdown` trên tay nắm mới bật `item.draggable = true`, nên các ô nhập trong phần chỉnh sửa vẫn bôi chọn chữ được.
- `dragstart` ghi `draggedIndex`; `dragover` tính nửa trên/nửa dưới của hàng đích (`clientY` so với giữa hàng) để hiện đường kẻ chèn trước/sau; `drop` gọi `moveStopTo`.
- Bàn phím: focus tay nắm rồi nhấn ↑/↓ gọi `moveStop`. `reorderStops` lo `snapshotDay`, lưu, render, trả focus (`pendingFocus`) về tay nắm, và báo kèm Undo.
- **Kéo-thả không tự `settleOrder`**: thứ tự do người dùng kéo được giữ nguyên, kể cả khi giờ hiển thị thành ra đảo lộn.

### 10.9. Tour

- `stopsForTour(tour, day)`: tour mẫu → `buildTourStops` theo mốc xuất phát của ngày và các điểm đã dùng ở ngày khác; tour tự lưu → giữ các điểm đã lưu (bỏ điểm không còn trong danh mục), chọn lại quán gần nhất.
- `useTour`: chụp bản cũ, thay các điểm của ngày, lưu, render, báo kèm Undo. Nếu ngày đã có điểm thì nút hiện "Replace with this tour" và **hỏi xác nhận** bằng hộp thoại.
- `planEmptyDays` ("Fill all empty days"): điền các ngày trống bằng các tour khác nhau, xoay vòng `TOURS[index % 3]`, đánh dấu điểm đã dùng để tránh lặp.
- Tour có thể mở trực tiếp bằng `?tour=<id>` (áp dụng ngay nếu Ngày 1 trống).

### 10.10. Rút ngắn tuyến: `optimiseDay`

Gọi `optimizeOrder`, so sánh tổng km trước/sau: **chỉ nhận kết quả nếu giảm hơn 0,05 km**, nếu không khôi phục thứ tự cũ và báo "would not shorten the route". Thành công thì báo "~X km to ~Y km straight-line" kèm Undo.

### 10.11. Cấu hình chuyến đi

- Đổi ngày bắt đầu: kiểm tra hợp lệ rồi lưu và render.
- `setDayCount(days, field)`: gói free vượt `FREE_MAX_DAYS` → báo lỗi gợi ý nâng cấp; ngoài khoảng → báo lỗi ngay cạnh ô sai (`aria-invalid`), **không tự sửa**. Giảm số ngày chỉ **ẩn** các ngày thừa (dữ liệu giữ nguyên) và báo; tăng lại sẽ khôi phục.
- Ô ngày kết thúc và số ngày đồng bộ qua `daysBetween`.
- Đổi mốc xuất phát chỉ tính lại khoảng cách và gợi ý, **giữ nguyên** các điểm và quán đã chọn.

### 10.12. Thư viện, chia sẻ, xuất lịch, in

- **Save current plan** (`#save-plan`): từ chối nếu chưa có điểm nào; dùng `savePlan` (free bị giới hạn 1 bản). **Start a new empty plan** hỏi xác nhận nếu đang có điểm.
- **Save as my tour** (`#save-tour`): lấy các điểm của ngày hiện tại theo thứ tự hiển thị.
- `replaceTrip(next, text)`: thay toàn bộ lịch bằng bản sao sâu (`structuredClone`) và trả hàm hoàn tác nếu lịch cũ có nội dung.
- `copyShareLink`: `navigator.clipboard.writeText`; bị từ chối thì hiện ô để tự sao chép.
- `downloadCalendar`: `buildIcs` → `Blob` → `URL.createObjectURL` → thẻ `<a download>` ẩn → `click()` → `revokeObjectURL`.
- `print`: `renderPrintView()` dựng bản in rồi `window.print()`; CSS `@media print` (trong `plan.css`) ẩn form và thanh công cụ.
- `updateLibrary(action)`: bọc thao tác thư viện trong `try/catch` (bộ nhớ trình duyệt có thể đầy).

### 10.13. Khối khởi tạo cuối file

```
spots = await loadSpots();  byId = Map(spots)
sharedNotice = applySharedTrip()      (đọc #plan= trong URL, thay lịch, xoá hash bằng history.replaceState)
removed = pruneTrip(trip, validIds)   (bỏ điểm không còn trong danh mục)
điền select món/địa điểm (món đã yêu thích có ♥)
đọc ?food, ?venue, ?place, ?tour từ query để chọn sẵn
render()
bỏ thuộc tính inert của #trip-setup, #planner-workspace, #plan-library
catch → hiện #planner-error (nút Try again = reload);  finally → ẩn #planner-loading
```

`inert` khoá toàn bộ vùng lập lịch trong lúc API chưa tải xong, để người dùng không thao tác khi thiếu dữ liệu.

---

## 11. Mô hình dữ liệu chuyến đi

Ví dụ một lịch hợp lệ (`localStorage["hanoi-local-trip-v2"]`):

```json
{
  "startDate": "2026-10-05",
  "dayCount": 2,
  "originId": "hoan-kiem",
  "days": [
    {
      "originId": null,
      "stops": [
        { "kind": "food",  "spotId": "food-pho-bo", "slot": "morning", "venueId": "pho-bat-dan" },
        { "kind": "place", "spotId": "place-temple-of-literature", "slot": "morning", "startTime": 570, "duration": 90 },
        { "kind": "custom", "spotId": "custom-3f2a...", "slot": "afternoon", "name": "Coffee with friends", "address": "" }
      ]
    },
    { "originId": "old-quarter", "stops": [] }
  ]
}
```

| Trường | Ý nghĩa |
|---|---|
| `kind` | `food`, `place` hoặc `custom` (điểm người dùng tự nhập) |
| `spotId` | Id trong danh mục; điểm `custom` có id `custom-<uuid>` |
| `slot` | `morning`, `afternoon`, `evening` |
| `venueId` | Quán được chọn (chỉ món ăn) |
| `startTime` | Giờ **ghim** (số phút từ 00:00, 0..1439); thiếu nghĩa là tự động |
| `duration` | Thời lượng riêng (15..480 phút); thiếu thì dùng mặc định |
| `originId` (trong ngày) | Mốc riêng của ngày; `null` nghĩa là dùng mốc chung |

Giờ đến/rời, khoảng cách, cảnh báo **không được lưu**; chúng được **tính lại** mỗi lần render từ dữ liệu trên.

---

## 12. Các luồng end-to-end

### 12.1. Mở trang Food

```
Trình duyệt GET /food.html → express.static phát file
food.page.js: initAuth() → GET /api/auth/me ;  loadSpots() → GET /api/spots
  server: apiRouter → express.json → spotsRouter → listSpots() → SQLite → toSpot() ghép FOOD_VENUES → sendList()
  trình duyệt: lọc kind=food, dựng thẻ bằng el()/link()/picture()
  ảnh: GET /assets/images/spots/food-pho-bo → resolveImage thử .avif→.webp→.jpg... → sendFile
```

### 12.2. Vào trang Plan khi chưa đăng nhập

```
GET /plan.html → app.get(['/plan','/plan.html'], requireUserPage)
  → currentUser(req) = null → 302 /login.html?next=%2Fplan.html
login.page.js: sau khi đăng nhập thành công → location.assign(safeNext(next)) → /plan.html
```

### 12.3. Đặt một giờ cụ thể cho điểm dừng

```
Người dùng sửa "Start time" → sự kiện change
  → snapshotDay → bỏ điểm khỏi danh sách → placeTimed (giữ giờ, chèn đúng chỗ, settleOrder)
  → save() → render() → scheduleDay tính lại → hàng nào trùng được tô đỏ
  → message("... now starts at 10:00. Warning: this time overlaps ...", Undo)
```

### 12.4. Chia sẻ lịch (Premium)

```
Tools → Copy share link → shareUrl(trip) = <trang>#plan=<base64url(JSON)>
Người nhận mở link → khối khởi tạo → sharedTripFromHash() → decodeTrip() → normalizeTrip()
  → replaceTrip(shared) → history.replaceState (xoá hash) → message("Shared plan loaded.", Undo nếu có lịch cũ)
```

### 12.5. Nâng cấp Premium

Xem sơ đồ ở mục 5.9. Điểm mấu chốt: trình duyệt máy tính **hỏi lại** (`poll`) mỗi 2 giây, còn người "trả tiền" thao tác ở điện thoại; hai bên chỉ gặp nhau qua trạng thái đơn trong SQLite.

---

## 13. Bảo mật và hiệu năng

### 13.1. Đã có

| Chủ đề | Cách làm |
|---|---|
| Mật khẩu | scrypt + salt ngẫu nhiên; so sánh bằng `timingSafeEqual` |
| Phiên | Cookie ký HMAC-SHA256, hạn 7 ngày, `httpOnly`, `sameSite=lax`, `secure` ở production |
| Dò mật khẩu | Khoá sau 8 lần sai trong 15 phút theo IP + email; cùng một thông báo lỗi cho mọi trường hợp sai |
| Google | `verifyIdToken` (chữ ký, hạn, audience, email đã xác minh) |
| Phân quyền | Server kiểm tra ở route API (`requireUser`/`requireAdmin`) **và** ở route trang (`requireUserPage`/`requireAdminPage`) |
| SQL injection | Mọi truy vấn dùng prepared statement với `?`/tham số đặt tên |
| XSS | Frontend không dùng `innerHTML`; chữ đi qua `textContent` |
| Open redirect | `safeNext` chỉ nhận đường dẫn nội bộ |
| Validate đầu vào | Email, tên, mật khẩu; `validateSpot` kiểm tra từng trường; body JSON ≤ 20 KB |
| Ràng buộc DB | `CHECK`, `UNIQUE`, `FOREIGN KEY ... ON DELETE CASCADE` |
| Tự bảo vệ admin | Admin không đổi quyền/xoá chính mình |
| Khác | Tắt `x-powered-by`; link ngoài `noopener noreferrer`; chặn `..` trong đường dẫn ảnh; `.env` và `.sqlite` trong `.gitignore` |

### 13.2. Chưa có (hướng phát triển)

Security headers (`helmet`, CSP), rate limit toàn cục (hiện chỉ đăng nhập), chống CSRF bằng token (hiện chỉ dựa `sameSite=lax`), thu hồi phiên phía server, bộ đếm sai lưu bền (hiện trong RAM), HTTPS/HSTS khi deploy.

### 13.3. Hiệu năng

- Ảnh danh mục có `loading="lazy"` kèm `width`/`height`; ảnh hero dùng `fetchpriority="high"`; font `preload`.
- Ảnh được chuyển sang WebP/AVIF (`scripts/optimize-images.mjs`); `resolveImage` chọn định dạng có sẵn.
- File tĩnh cache 1 giờ ở production; ảnh qua `resolveImage` cache 30 ngày; trang cần đăng nhập `private, no-cache`.
- API danh mục chỉ gọi **một lần mỗi trang**; tìm kiếm lọc trong bộ nhớ.
- Lập lịch chạy trong trình duyệt nên không phụ thuộc mạng.

---

## 14. Kiểm thử, công cụ và hạn chế đã biết

### 14.1. Kiểm thử (`tests/`)

| File | Loại | Kiểm tra gì | Cần server/Chrome |
|---|---|---|---|
| `structure.test.mjs` | Node thuần | Đường dẫn import, tài nguyên HTML, lệnh npm; tài liệu/DB không nằm trong thư mục công khai | Không |
| `schedule.test.mjs` | Node thuần | Xếp giờ, cảnh báo, đổi vị trí, kéo-thả, `settleOrder`, tour, chia sẻ, `.ics`, thư viện | Không |
| `guide.test.mjs` | Chrome headless | Luồng Home → Food → tour → lịch | Có |
| `plan-ux.test.mjs` | Chrome headless | Trải nghiệm trang Plan (undo, điều khiển, tab) | Có |

`tests/helpers/browser.mjs` mở Chrome headless với profile tạm, nói chuyện qua WebSocket/CDP (Chrome DevTools Protocol), cung cấp `evaluate`, `fill`, `click`, `key`, rồi đóng trình duyệt và xoá profile. `npm run qa` chạy cả bốn bộ.

### 14.2. Script

- `scripts/benchmark-api.mjs`: đo ba API GET với 1, 20, 50 yêu cầu đồng thời (200 yêu cầu mỗi kịch bản, lặp nhiều lượt), báo trung vị và p95.
- `scripts/optimize-images.mjs <thư-mục-nguồn> [--dry-run] [--format=webp|avif]`: phân loại theo tiền tố tên (`food-`/`place-` → `spots`, `hero-` → `hero`, `tile-` → `tiles`), thu nhỏ cạnh dài (1200/1600/1200 px), chất lượng 78, dùng `cwebp` hoặc `sips`.
- `scripts/import-group-food.mjs`: thêm món nhóm chưa có trong DB mà không ghi đè.

### 14.3. Hạn chế và điểm cần lưu ý

1. **Giới hạn gói free chỉ ở trình duyệt.** 3 ngày, 1 lịch và việc khoá chia sẻ/`.ics`/in được kiểm tra bằng JavaScript phía client; lịch nằm trong `localStorage`, không có API lưu lịch ở server. Đây là rào cản trải nghiệm, không phải kiểm soát an toàn.
2. **Thanh toán là giả lập.** Không có tiền thật, không có cổng thanh toán; ai mở `pay.html?order=<code>` và xác nhận là đơn được trả.
3. **Lịch không đồng bộ giữa thiết bị.** Dữ liệu ở `localStorage` của từng trình duyệt; chỉ chia sẻ được bằng link (Premium).
4. **Khoảng cách và thời gian là ước tính** (Haversine × 1.3), không phải định tuyến thực. Giờ mở cửa là chuỗi tham khảo trong danh mục.
5. **Giờ `.ics` là "floating"**, nhưng thông báo sau khi tải ghi "Times are Hanoi local times". Lịch điện thoại hiển thị đúng giờ trên mặt đồng hồ, không gắn múi giờ; nếu người dùng đổi múi giờ thiết bị thì giờ không tự quy đổi.
6. **Kéo-thả không tự `settleOrder`**, và HTML5 drag & drop thường không hoạt động trên màn hình cảm ứng (dự án chỉ làm cho desktop).
7. **Số món:** `seed-data.js` có thể tạo 14 món, DB hiện tại có 10 nếu chưa chạy `import-group-food.mjs`.
8. **`npm run assets:webp` không có tham số** sẽ báo lỗi *Usage* vì script cần thư mục nguồn.
9. **`SESSION_SECRET` mặc định là chuỗi dev**; phải đặt giá trị thật khi triển khai.
10. **Trang admin dùng `confirm()` của trình duyệt** cho thao tác xoá.
11. **Thư mục ảnh `hero/`** còn 7 file JPG/PNG gốc không được code tham chiếu (chiếm khoảng 7,5 MB).
12. Một số bộ QA giao diện (`qa:guide`, `qa:plan`) có thể không chạy đúng nếu không đăng nhập, vì `/plan` yêu cầu phiên.

---

## 15. Thuật ngữ

| Thuật ngữ | Giải thích |
|---|---|
| **DOM** | Cây các phần tử HTML mà JavaScript đọc và sửa |
| **Render** | Dựng hoặc cập nhật giao diện từ dữ liệu |
| **Middleware** | Hàm Express chạy giữa request và response, có thể chuyển tiếp bằng `next()` hoặc kết thúc request |
| **Router** | Nhóm các đường dẫn API gắn vào một tiền tố (`/api/auth`...) |
| **Service** | Tầng chứa nghiệp vụ và truy vấn SQL, tách khỏi HTTP |
| **Singleton** | Đối tượng chỉ tạo một lần và dùng chung (kết nối DB) |
| **Prepared statement** | Câu SQL có chỗ trống `?`; giá trị truyền riêng nên không thể bị hiểu thành lệnh |
| **Upsert** | `INSERT` nếu chưa có, `UPDATE` nếu đã có (`ON CONFLICT DO UPDATE`) |
| **Transaction** | Nhóm thao tác ghi cùng thành công (`COMMIT`) hoặc cùng huỷ (`ROLLBACK`) |
| **WAL** | Chế độ nhật ký của SQLite cho phép đọc và ghi cùng lúc ít khoá nhau |
| **HMAC** | Chữ ký tạo từ khoá bí mật; dùng để chứng minh cookie không bị sửa |
| **scrypt** | Hàm băm mật khẩu cố ý tốn tài nguyên để chống dò |
| **`timingSafeEqual`** | So sánh byte với thời gian không phụ thuộc vị trí khác biệt |
| **Haversine** | Công thức khoảng cách giữa hai tọa độ trên mặt cầu |
| **Slot** | Buổi trong ngày: `morning`, `afternoon`, `evening` |
| **Pinned (ghim)** | Điểm có `startTime` do người dùng đặt, được giữ đúng giờ |
| **Pure function (hàm thuần)** | Hàm chỉ phụ thuộc đầu vào và không có tác dụng phụ, nên dễ kiểm thử |
| **base64url** | Cách biểu diễn byte bằng ký tự an toàn trong URL; không phải mã hoá bảo mật |
| **Floating time (ICS)** | Giờ không gắn múi giờ |
| **`inert`** | Thuộc tính HTML khoá phần tử và con của nó khỏi mọi tương tác |
| **Lazy loading** | Trình duyệt chỉ tải ảnh khi người dùng cuộn tới gần |
| **CDP** | Chrome DevTools Protocol, giao thức để chương trình điều khiển Chrome |
