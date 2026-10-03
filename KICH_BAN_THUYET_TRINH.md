# Kịch bản thuyết trình Hanoi Local

**Mạch trình bày:** Pain point → Giải pháp và demo → Future work.
**Thời lượng:** khoảng 7 phút (có bản rút gọn 5 phút ở cuối). Mỗi mục ghi sẵn số phút, **lời nói** (in nghiêng/trích dẫn) và **thao tác** trên màn hình.

| Phần | Thời gian | Nội dung |
|---|---|---|
| 0. Mở đầu | 0:00 – 0:20 | Chào, giới thiệu đề tài |
| 1. Pain point | 0:20 – 1:30 | Vấn đề của người đi du lịch Hà Nội |
| 2. Giải pháp | 1:30 – 2:10 | Hanoi Local là gì, kiến trúc trong 30 giây |
| 3. Demo | 2:10 – 5:50 | Chạy thật trên web |
| 4. Future work | 5:50 – 6:40 | Hướng phát triển và hạn chế |
| 5. Kết | 6:40 – 7:00 | Tóm tắt, cảm ơn, hỏi đáp |

---

## Chuẩn bị trước khi lên trình bày

- [ ] `npm start` chạy sẵn tại <http://localhost:3000>. Mở sẵn **Home** ở một tab.
- [ ] Chuẩn bị **hai tài khoản**: một tài khoản **free** (để cho thấy giới hạn 3 ngày và lời mời nâng cấp) và một tài khoản **Premium hoặc admin** (admin luôn có Premium). **Chia sẻ link, xuất `.ics` và in chỉ hoạt động với Premium**, nên phần demo 3.4 phải dùng tài khoản Premium/admin.
- [ ] Xoá lịch cũ trong `localStorage` để trang Plan sạch, ngày bắt đầu là một ngày trong tương lai.
- [ ] Có **Plan B**: ảnh chụp màn hình hoặc video quay sẵn, phòng khi mạng hoặc server lỗi.
- [ ] Thu nhỏ thông báo, đóng thông báo hệ thống, zoom trình duyệt 110–125% để người ngồi xa đọc được.
- [ ] Nhớ trước 3 con số: **10 món, 10 địa điểm, mỗi món ít nhất 2 quán**.

---

## 0. Mở đầu (0:00 – 0:20)

> "Xin chào thầy/cô và các bạn. Em là [tên], thuộc Nhóm 33. Hôm nay nhóm em trình bày **Hanoi Local**, một website bằng tiếng Anh dành cho **khách du lịch nước ngoài** lần đầu đến Hà Nội, giúp họ khám phá món ăn, địa điểm và biến chúng thành một lịch trình cụ thể theo từng giờ."

**Thao tác:** màn hình hiện trang Home hoặc slide tiêu đề.

---

## 1. Pain point (0:20 – 1:30)

Mục tiêu: để người nghe **đứng vào vị trí một du khách nước ngoài** lần đầu đến Hà Nội. Kể như một tình huống thật, không đọc danh sách. Nhân vật có thể đặt tên (ví dụ **Anna, du khách từ châu Âu, có 3 ngày ở Hà Nội**) để câu chuyện dễ nhớ.

> "Hãy tưởng tượng Anna, một du khách từ nước ngoài, lần đầu đến Hà Nội và chỉ có ba ngày. Cô ấy muốn thử phở, bún chả, và đi Văn Miếu, Hồ Gươm. Cô ấy sẽ gặp những vấn đề gì?"
>
> "**Thứ nhất, rào cản ngôn ngữ và văn hoá ẩm thực.** Thực đơn và biển hiệu phần lớn là tiếng Việt. Anna không biết 'bún chả' là gì, ăn thế nào, nên đến quán nào. Bản đồ và tên phố cũng toàn tiếng Việt có dấu, rất khó đọc, khó gõ, khó nhờ người chỉ đường."
>
> "**Thứ hai, thông tin bằng tiếng Anh thì rải rác và không đáng tin.** Món ăn ở một blog, quán ở Google Maps, giờ mở cửa ở trang khác, giá vé ở trang khác nữa. Chỉ để chọn một bữa trưa, cô ấy phải mở năm tab, và không biết trang nào còn đúng."
>
> "**Thứ ba, không quen địa hình, không biết gần hay xa.** Khu Phố Cổ có rất nhiều ngõ nhỏ, đường một chiều, xe máy dày đặc. Quán phở và Văn Miếu cách nhau bao xa? Đi bộ được không hay phải gọi xe? Không có cảm giác về khoảng cách, du khách rất dễ đi vòng và mất cả buổi chỉ vì đi lại."
>
> "**Thứ tư, thời gian có hạn và giờ mở cửa khó lường.** Du khách chỉ ở vài ngày, nên mỗi giờ đều quý. Có nơi đóng cửa thứ Hai, có nơi chỉ mở buổi sáng, quán nổi tiếng chỉ bán đến trưa. Đến nơi mới biết thì đã muộn và không có phương án khác."
>
> "**Thứ năm, có kế hoạch rồi cũng khó mang theo.** Ghi vào Notes thì khó chia sẻ cho bạn đi cùng, khó in, khó đưa vào lịch điện thoại, và đổi một điểm là phải sắp xếp lại từ đầu."

Chốt pain point (nói chậm, nhấn mạnh):

> "Tóm lại: du khách nước ngoài **có nhiều thông tin nhưng không hiểu hết, không biết sắp xếp, và không có công cụ biến chúng thành một lịch trình dùng được ở một thành phố xa lạ**. Đó là khoảng trống nhóm em muốn lấp."

**Gợi ý slide:** hình một du khách đứng giữa phố cổ, kèm 5 ý ngắn: *Ngôn ngữ · Thông tin rải rác · Không biết gần/xa · Thời gian và giờ mở cửa · Khó mang theo*.

**Lưu ý khi nói:** không đưa số liệu thống kê (ví dụ "x% du khách gặp khó khăn") trừ khi bạn có nguồn rõ ràng. Nếu có thể, kể một trải nghiệm thật của bạn bè hoặc người quen là du khách nước ngoài sẽ thuyết phục hơn.

---

## 2. Giải pháp và kiến trúc (1:30 – 2:10)

> "Hanoi Local gom ba việc vào một nơi, **hoàn toàn bằng tiếng Anh**: giới thiệu món và quán (kèm địa chỉ cụ thể), giới thiệu địa điểm, rồi **tự xếp thành lịch 1 đến 30 ngày** với giờ đến, giờ rời, khoảng cách và cảnh báo giờ mở cửa. Du khách không cần biết tiếng Việt và không phải mở nhiều trang."

Nói kiến trúc thật ngắn (có thể kèm sơ đồ trong README):

> "Về kỹ thuật, em dùng **Node.js và Express** làm một server duy nhất vừa phục vụ trang web vừa cung cấp API, dữ liệu lưu trong **SQLite**. Giao diện viết bằng **HTML, CSS và JavaScript thuần**, không dùng framework. Phần xếp giờ là một module riêng nên kiểm thử được độc lập. Lịch của người dùng lưu ngay trong trình duyệt, nên thao tác rất nhanh và không cần chờ server."

Nếu có người hỏi sâu: tách ba tầng router → service → database; mật khẩu băm scrypt; phiên là cookie `httpOnly` ký HMAC.

---

## 3. Demo (2:10 – 5:50)

Đi theo **đúng câu chuyện của Anna**: hiểu món và quán → biết gần/xa → có giờ → chia sẻ và mang theo. Mỗi bước nối lại một nỗi đau ở phần 1. Khi demo, **nói bằng góc nhìn du khách** ("nếu em là khách nước ngoài...").

### 3.1. Hiểu món và quán, bằng tiếng Anh: Home và Eat & drink (2:10 – 3:00)

**Thao tác:** Home → bấm **Eat & drink** → gõ "phở" vào ô tìm → mở một món.

> "Đây là Home, có ba tour gợi ý. Em vào **Eat & drink**. Mười món đặc trưng của Hà Nội được giới thiệu bằng tiếng Anh, mỗi món có **ít nhất hai quán cụ thể** với địa chỉ đã kiểm tra. Một du khách chưa biết 'phở' hay 'bún chả' là gì vẫn tìm được món và biết nên đến quán nào. Đây trả lời nỗi đau thứ nhất và thứ hai."

**Thao tác:** đổi **Start from** sang một mốc (ví dụ Hoan Kiem Lake) → quán được xếp lại.

> "Em đổi điểm xuất phát sang Hồ Hoàn Kiếm, danh sách quán **tự xếp lại, quán gần lên trước**. Đây trả lời nỗi đau thứ ba: du khách không cần quen địa hình vẫn biết cái nào gần. Lưu ý: đây là khoảng cách ước tính theo đường chim bay, nút **Directions** mở Google Maps để xem đường đi thực tế."

**Thao tác:** bấm tim lưu món yêu thích. Bấm **Add to plan** ở một quán.

### 3.2. Địa điểm: See & do (3:00 – 3:25)

**Thao tác:** vào See & do → tìm "Temple of Literature".

> "Với địa điểm, em thấy thời gian tham quan gợi ý, giá vé và giờ mở cửa. Em thêm Văn Miếu vào lịch."

### 3.3. Plan your day: phần chính (3:25 – 5:20)

**Thao tác:** vào **Plan your day**. (Nếu chưa đăng nhập, trang chuyển sang Login: đăng nhập nhanh để cho thấy luồng tài khoản.)

> "Trang này yêu cầu đăng nhập vì lịch gắn với tài khoản của bạn."

**Bước 1: Tạo lịch.** Chọn ngày bắt đầu, **số ngày = 2**, **Start from** = Hoan Kiem Lake.

> "Em chọn ngày bắt đầu, hai ngày, xuất phát từ Hồ Gươm."

**Bước 2: Tour mẫu.** Ở Day 1, chọn một tour trong **Suggested tours**.

> "Em chọn một tour mẫu cho ngày một. Tour được dựng **theo mốc xuất phát** và mỗi ngày một khác. Lịch hiện ra với **giờ đến, giờ rời** từng điểm, khoảng cách tới điểm trước và thời gian di chuyển. Đây trả lời nỗi đau thứ tư: thời gian có hạn thì lịch phải có giờ."

**Bước 3: Thêm điểm.** Chuyển sang Day 2, thêm một món và một địa điểm.

> "Ngày hai em tự thêm: một món ăn và một địa điểm. Em chọn buổi sáng hoặc chiều, hệ thống tự xếp giờ."

**Bước 4: Sắp xếp và cảnh báo trùng giờ.** Mở **Details & edit** của một điểm, đặt **Start time** trùng với điểm khác.

> "Giờ em thử đặt giờ cho một điểm sao cho **trùng** với điểm khác. Hệ thống **giữ đúng giờ em chọn**, xếp lại theo thời gian, và **tô đỏ cả hai ô bị trùng** kèm cảnh báo. Em không bị chặn, nhưng biết ngay chỗ nào có vấn đề. Cảnh báo giờ mở cửa cũng hiện tương tự, để du khách không đến nơi mới biết đã đóng cửa."

**Bước 5: Kéo thả và Undo.** Kéo tay nắm "⠿" để đổi thứ tự một điểm, sau đó bấm **Undo** ở thông báo góc phải.

> "Muốn đổi thứ tự thì **kéo thả**. Giờ tự tính lại. Làm sai thì bấm **Undo**. Thông báo tự ẩn sau 5 giây."

**Bước 6 (tuỳ chọn): Rút ngắn tuyến.** Tools → **Shorten the route (reorder)**.

> "Nút này sắp lại các điểm trong từng buổi theo kiểu đi tới điểm gần nhất để giảm quãng đường. Đây là phương pháp xấp xỉ, không bảo đảm ngắn nhất."

### 3.4. Lưu, chia sẻ, đưa ra khỏi web (5:20 – 5:50)

Đây trả lời nỗi đau thứ năm.

**Thao tác (dùng tài khoản Premium/admin):** ngay dưới **Your trip**, gõ tên rồi **Save current plan**. Sau đó **Tools** → **Copy share link** / **Print plan** / **Add to calendar (.ics)**. Mở **Google Maps ↗** nếu còn thời gian.

> "Em lưu lịch với một cái tên ngay dưới phần Your trip. Em có thể **copy link chia sẻ**: toàn bộ lịch nằm trong chính đường link, không qua server. Em có thể **in**, **tải file lịch .ics** để đưa vào điện thoại, hoặc **mở cả tuyến trong Google Maps**."

**Thao tác:** tải lại trang → lịch vẫn còn.

> "Tải lại trang, lịch vẫn còn."

### 3.5. (Tuỳ chọn, nếu còn thời gian) Tài khoản và Premium

> "Ở gói free, người dùng lập tối đa **3 ngày và lưu 1 lịch**. Gói **Premium** mở lên **30 ngày và 10 lịch**. Nâng cấp bằng quét mã QR, hiện là **thanh toán giả lập** cho mục đích demo. Tài khoản admin có trang quản trị để quản lý người dùng và thêm, sửa, xoá món hoặc địa điểm."

---

## 4. Future work (5:50 – 6:40)

Nói thẳng hạn chế hiện tại, rồi đưa hướng phát triển. Cách này thuyết phục hơn là chỉ nói điểm mạnh.

> "Phiên bản hiện tại còn một số hạn chế mà nhóm em biết rõ, và đó cũng là hướng phát triển tiếp theo."

**Về tính năng**
- **Khoảng cách và thời gian di chuyển thực tế:** hiện là đường chim bay nhân hệ số. Tích hợp API định tuyến (Google Directions hoặc OpenStreetMap/OSRM) để có thời gian đi thực, kể cả tắc đường.
- **Giờ mở cửa thời gian thực:** hiện là dữ liệu tham khảo trong danh mục. Kết nối nguồn dữ liệu trực tiếp.
- **Đồng bộ lịch giữa các thiết bị:** hiện lịch nằm trong `localStorage` của từng trình duyệt. Lưu lịch lên server theo tài khoản để dùng ở nhiều máy.
- **Gợi ý thông minh hơn:** tour hiện dựng theo quy tắc. Có thể cá nhân hoá theo sở thích, ngân sách, thời tiết.
- **Mở rộng nội dung:** thêm món, địa điểm, đánh giá của người dùng, ảnh thật; mở rộng sang thành phố khác.
- **Đa ngôn ngữ:** hiện chỉ có tiếng Anh. Thêm các ngôn ngữ du khách hay dùng (Hàn, Nhật, Trung, Pháp...).
- **Cầu nối ngôn ngữ tại chỗ:** nút hiển thị tên món/địa chỉ **bằng tiếng Việt** để đưa cho tài xế, nhân viên quán; kèm vài câu giao tiếp cơ bản và cách phát âm.
- **Giao diện điện thoại:** du khách thường dùng điện thoại khi đi trên đường, trong khi giao diện hiện thiết kế cho desktop.
- **Thông tin du lịch thực tế:** gợi ý phương tiện (Grab, taxi, đi bộ), mức giá tham khảo để tránh bị chặt chém, lưu ý văn hoá (ví dụ cách ăn từng món).
- **Thanh toán thật** cho Premium (cổng thanh toán) thay cho bản giả lập.

**Về kỹ thuật và bảo mật**
- Thêm **security headers** (helmet, CSP), **rate limit toàn cục**, **chống CSRF** bằng token, **thu hồi phiên** phía server.
- **Tối ưu ảnh:** `srcset`/`<picture>` theo kích thước màn hình, nén lại ảnh lớn.
- **Kiểm thử tự động** đầy đủ cho luồng đăng nhập và giao diện.
- **Triển khai** lên server thật với HTTPS.

> "Nhóm em ưu tiên ba việc: **giao diện điện thoại**, **đa ngôn ngữ cùng cầu nối tiếng Việt tại chỗ**, và **thời gian di chuyển thực tế**, vì đó là những thứ du khách cần nhất khi thực sự đang đi trên đường phố Hà Nội."

---

## 5. Kết (6:40 – 7:00)

Quay lại pain point để khép vòng.

> "Quay lại Anna: ba ngày ở Hà Nội, thực đơn tiếng Việt, năm tab, không biết gần xa. Với Hanoi Local, cô ấy đi từ **hiểu và chọn món** đến **một lịch trình có giờ, có cảnh báo, có thể chia sẻ**, bằng tiếng Anh và trong một nơi duy nhất. Em xin cảm ơn thầy/cô và các bạn đã lắng nghe. Em sẵn sàng nhận câu hỏi."

---

## Bản rút gọn 5 phút

| Phần | Thời gian | Cắt gì |
|---|---|---|
| Mở đầu + Pain point | 0:00 – 1:00 | Chỉ nói 3 nỗi đau: ngôn ngữ và món ăn lạ, không biết gần/xa, thời gian có hạn |
| Giải pháp | 1:00 – 1:20 | Bỏ phần kiến trúc, chỉ nói "Node + SQLite + JS thuần" |
| Demo | 1:20 – 4:20 | Bỏ See & do, bỏ Shorten the route, bỏ Premium. Giữ: tìm món + đổi mốc → tour → cảnh báo trùng giờ → kéo thả/Undo → chia sẻ |
| Future work | 4:20 – 4:50 | Chỉ nói 3 ý: đồng bộ lịch, thời gian di chuyển thực, bảo mật |
| Kết | 4:50 – 5:00 | Một câu |

---

## Câu hỏi có thể gặp và cách trả lời

**"Dữ liệu quán ăn lấy từ đâu? Có chính xác không?"**
Danh mục do nhóm tự thu thập và kiểm tra địa chỉ, nằm trong cơ sở dữ liệu và file `food-venues.js`. Giờ mở cửa là thông tin tham khảo, nên giao diện luôn nhắc kiểm tra lại trên Google Maps. Đây là lý do future work có mục dữ liệu thời gian thực.

**"Khoảng cách tính thế nào? Có đúng không?"**
Dùng công thức Haversine trên tọa độ để ra đường chim bay, rồi nhân hệ số 1,3 và quy ra thời gian đi bộ hoặc đi xe. Nó chỉ là ước tính; Google Maps cho đường đi thực. Nhóm nói rõ điều này trên giao diện.

**"Web chỉ có tiếng Anh, sao gọi là cho du khách nước ngoài?"**
Tiếng Anh là ngôn ngữ chung cho phần lớn du khách quốc tế, nên nhóm chọn nó cho phiên bản đầu. Đa ngôn ngữ và nút hiển thị tên/địa chỉ bằng tiếng Việt (để đưa cho tài xế, nhân viên quán) nằm trong future work.

**"Sao không dùng React/framework?"**
Nhóm muốn hiểu rõ nền tảng web: DOM, module, fetch. Dự án đủ nhỏ để JavaScript thuần vẫn dễ đọc, và module xếp lịch được tách ra để kiểm thử bằng Node.

**"Tour mẫu có dùng AI không?"**
Không. Tour dựng bằng quy tắc: chấm điểm ứng viên theo khoảng cách, độ hợp chủ đề và việc đã dùng ở ngày khác. Dùng AI để cá nhân hoá là một hướng future work.

**"Bảo mật thế nào?"**
Mật khẩu băm scrypt có salt; phiên là cookie `httpOnly` ký HMAC; giới hạn đăng nhập sai; truy vấn SQL dùng tham số; frontend dùng `textContent` để tránh XSS; trang `/plan` và `/admin` được server kiểm tra quyền. Phần còn thiếu (CSP, CSRF token, thu hồi phiên) nằm trong future work.

**"Thanh toán Premium có thật không?"**
Không. Đây là luồng giả lập để minh hoạ, không có tiền thật và không có cổng thanh toán.

**"Nếu hai điểm trùng giờ thì sao?"**
Hệ thống giữ đúng giờ người dùng chọn, xếp theo thời gian và tô đỏ hai ô trùng cùng cảnh báo, để người dùng tự quyết định.

**"Lịch có mất không?"**
Lịch lưu trong trình duyệt của người dùng nên tải lại vẫn còn, nhưng không tự sang máy khác. Đồng bộ theo tài khoản là việc ưu tiên trong future work.

---

## Mẹo khi trình bày

- Mỗi lần chuyển bước demo, **nhắc lại nỗi đau nó giải quyết** ("Đây trả lời nỗi đau thứ hai...") để người nghe thấy demo và pain point là một câu chuyện.
- **Đừng giải thích code** trong lúc demo. Nếu được hỏi, mới mở file (xem `HUONG_DAN_THUYET_TRINH.md`).
- Nói chậm ở phần pain point và kết; nói nhanh hơn ở các thao tác lặp.
- Nếu thao tác lỗi, **đừng xin lỗi lâu**: nói "em chuyển sang bản quay sẵn" rồi tiếp tục.
- Dùng **một nhân vật du khách xuyên suốt** (Anna) từ pain point tới demo và phần kết: người nghe nhớ câu chuyện lâu hơn nhớ danh sách tính năng.
- Phân vai nếu trình bày nhóm: một người nói, một người thao tác, đổi vai ở ranh giới giữa các phần (pain point → demo → future work).
