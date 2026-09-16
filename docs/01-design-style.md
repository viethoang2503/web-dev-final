# 01 — Design Style Specification

## 1. Design Read

Landing page du lịch dành cho khách muốn khám phá Hà Nội, mang ngôn ngữ editorial hiện đại, nhiều khoảng trắng, typography lớn và collage ảnh có chủ đích. Thiết kế lấy cảm hứng từ cách I amsterdam kể chuyện bằng nội dung và hình ảnh, nhưng phải có nhận diện riêng của Hà Nội.

### Design dials

- Design variance: 8/10 — bất đối xứng rõ nhưng vẫn cân bằng.
- Motion intensity: 4/10 — motion nhẹ, có ý nghĩa, không cinematic.
- Visual density: 4/10 — thoáng ở hero, dày hơn ở khu vực card.

### Ba nguyên tắc

1. **Content first:** hình ảnh và thông tin du lịch quan trọng hơn hiệu ứng.
2. **Bold but calm:** headline mạnh, phần còn lại gọn và dễ đọc.
3. **Hanoi specific:** hình ảnh, màu và copy phải gợi đúng Hà Nội, không phải template du lịch chung.

---

## 2. Reference Mockup

![Desktop landing-page mockup](assets/hanoi-local-landing-mockup.png)

### Những yếu tố cần giữ khi code

- Utility bar mỏng trên cùng.
- Logo chữ lớn bên trái.
- Navigation rõ ràng, không quá 5 mục chính.
- Hero chia hai nửa bất đối xứng.
- Headline rất lớn, canh trái.
- Collage 3–4 ảnh bên phải với các khối đỏ làm nền.
- CTA chính màu xanh cobalt.
- Phần category cards bắt đầu xuất hiện ngay dưới hero.

### Những yếu tố không cần khớp tuyệt đối

- Kích thước và vị trí chính xác từng ảnh.
- Font chữ trong ảnh AI.
- Các câu chữ trang trí viết tay.
- Nội dung ảnh nếu chưa có asset phù hợp.

---

## 3. Brand Foundation

### Logo dạng chữ

Tên hiển thị: **Hanoi Local**

- “Hanoi” dùng lacquer red.
- “Local” dùng near-black.
- Không sử dụng logo hoặc ký hiệu của I amsterdam.
- Logo phải hoạt động ở cả desktop và mobile.
- Mobile có thể giảm kích thước chữ nhưng không viết tắt thành HL.

### Voice and tone

- Ngắn gọn, tò mò, thân thiện.
- Không dùng câu quảng cáo phóng đại.
- Viết cho khách du lịch thật, không viết cho giáo viên chấm bài.
- Ưu tiên động từ: Explore, Taste, Save, Plan.

### Hero copy đã chốt

Heading:

    Discover Hanoi.
    Like a local.

Supporting copy:

    Taste the streets, explore timeless places,
    and plan a day that feels entirely yours.

CTA:

- Explore places
- Find local food

---

## 4. Color System

### Core palette

| Token | Value | Usage |
|---|---|---|
| --color-paper | #FCFCF8 | Page background |
| --color-surface | #FFFFFF | Cards, modal, menu |
| --color-ink | #111111 | Main text |
| --color-muted | #5E625F | Secondary text |
| --color-line | #D9DDD8 | Borders and separators |
| --color-red | #D82C35 | Hanoi brand accent, active nav |
| --color-blue | #075FD8 | Primary CTA and focus |
| --color-jade | #326B50 | Small labels and secondary accent |
| --color-success | #1E7A46 | Success feedback |
| --color-error | #B42318 | Validation and destructive feedback |

### Color rules

- Red là màu nhận diện, không dùng cho mọi button.
- Blue chỉ dành cho primary CTA và focus states.
- Jade dùng rất ít cho eyebrow text hoặc metadata.
- Không dùng gradient.
- Không dùng purple, neon hoặc glassmorphism.
- Body text trên nền sáng phải có contrast tối thiểu 4.5:1.

---

## 5. Typography

### Recommended pairing

- Display/headline: **Archivo**, weight 700–800.
- Body/UI: **Manrope**, weight 400–700.
- Fallback: Arial, Helvetica, sans-serif.

### Type scale

| Role | Desktop | Mobile | Notes |
|---|---:|---:|---|
| Hero heading | clamp(3.5rem, 7vw, 7rem) | 3.2rem | Line-height 0.92–1.0 |
| Section title | 3rem | 2rem | Tight tracking |
| Card title | 1.5rem | 1.25rem | 700 weight |
| Body large | 1.25rem | 1.05rem | Max 60–65 characters |
| Body | 1rem | 1rem | Line-height 1.55–1.7 |
| Label | 0.875rem | 0.875rem | Never below 14px |
| Metadata | 0.75rem | 0.75rem | Only secondary information |

### Typography rules

- Heading can use negative letter spacing.
- Body text never below 16px.
- Avoid all-caps paragraphs.
- All-caps is permitted for short eyebrow labels with wider tracking.
- Do not mix serif and sans-serif merely for decoration.

---

## 6. Layout System

### Container

- Maximum content width: 1440px.
- Desktop horizontal padding: 64–80px.
- Tablet horizontal padding: 32px.
- Mobile horizontal padding: 20px.

### Vertical spacing scale

    8, 12, 16, 24, 32, 48, 64, 96, 128

### Header

- Utility bar: 36px minimum.
- Main navigation: 84–92px desktop.
- Header may become sticky after the hero begins to scroll.
- Desktop nav: Home, Food, Places, My Day.
- Right actions: Favorite icon, Sign in/account.
- Mobile nav collapses into a menu button.

### Hero

- Desktop grid: approximately 46% content / 54% collage.
- Minimum desktop height: 680px, not fixed to 100vh.
- Copy remains left-aligned.
- Collage contains 3–4 images and 2–3 flat color blocks.
- Images use different aspect ratios but share consistent corner treatment.
- Decorative blocks must not cover important subjects.

### Category tiles

- Desktop: three columns.
- Tablet: two columns, third wraps.
- Mobile: one column.
- Each tile uses a real travel image, title and arrow.
- Title remains visible without relying on hover.

---

## 7. Homepage Section Specification

### Section A — Utility bar and navigation

- Small label: Hanoi travel guide.
- Language indicator may appear visually but must be disabled or marked future for the submission.
- Active nav gets a red underline.
- Sign in uses solid blue.

### Section B — Hero

- Headline, supporting copy and two CTAs.
- Photo collage includes:
  - Hoan Kiem Lake.
  - Old Quarter street.
  - Hanoi food.
  - Temple of Literature or another heritage detail.
- First CTA navigates to Places.
- Second CTA navigates to Food.

### Section C — Start with what you love

Three entry tiles:

- Local food.
- Historic Hanoi.
- Build my day.

### Section D — Local favourites

- 3–4 featured Food cards.
- Each card shows image, title, district, price and Favorite action.
- A View all food link leads to Food.

### Section E — Hanoi essentials

- 3 featured Places cards in an asymmetric editorial grid.
- Include visit duration and admission metadata.
- A View all places link leads to Places.

### Section F — Planner CTA

- Short explanation of My Day.
- Three labels: Morning, Afternoon, Evening.
- CTA opens My Day for logged-in users.
- Guest receives a login prompt.

### Section G — Footer

- Brand summary.
- Navigation links.
- Project credits.
- No fake social follower counts or newsletter form.

---

## 8. Component Rules

### Buttons

- Minimum height: 48px.
- Touch target: at least 44 × 44px.
- Primary: blue background, white text.
- Secondary: white background, dark border.
- Text action: no container unless focus or hover.
- Disabled state visibly different and non-clickable.

### Cards

- Avoid putting every section inside a rounded container.
- Border radius: 0–16px depending on image use; stay consistent.
- Use minimal shadow; prefer borders and spacing.
- Hover can move the image up 2–4px or slightly scale it.
- Hover must not be required to see information.

### Favorite control

- Outline heart when inactive.
- Filled red heart when active.
- Includes aria-label.
- Shows immediate feedback.

### Modals and drawers

- Detail uses modal/dialog.
- Favorites and My Day use right-side drawer on desktop.
- On mobile, drawer becomes full-width bottom sheet or full-screen panel.
- Escape closes desktop dialogs.
- Focus returns to the triggering button.

### Forms

- Visible label above every field.
- Error appears beneath the related field.
- Show/hide password control includes accessible name.
- Submit shows loading state.
- Never use placeholder as the only label.

---

## 9. Motion Specification

- Navigation underline: 150ms.
- Button hover/focus: 180–220ms.
- Card image hover: 220–260ms.
- Modal/drawer enter: 220–300ms.
- Hero collage may reveal once on page load with a subtle stagger.
- No infinite floating animation.
- No scroll hijacking.
- Respect prefers-reduced-motion.

Every animation must communicate hierarchy, feedback or a state transition.

---

## 10. Image Direction

### Photography style

- Documentary/editorial rather than glossy resort photography.
- Natural daylight and real street texture.
- People may appear naturally but should not dominate every image.
- Use specific Hanoi subjects.
- Avoid generic Asian city skylines.

### Technical image rules

- Use WebP or AVIF for final assets.
- Hero images should be prepared at appropriate display sizes.
- Below-the-fold images use loading="lazy".
- Declare width, height or aspect-ratio to avoid layout shift.
- Every meaningful image has descriptive alt text.

### Suggested aspect ratios

- Hero lake image: 4:3.
- Street image: 4:3 or 3:4.
- Food image: 4:3.
- Heritage detail: 4:3.
- Category tile: 16:9.
- Content cards: 4:3.

---

## 11. Responsive Behaviour

### 1024px and above

- Full desktop navigation.
- Two-column hero.
- Multi-image collage.
- Three-column category tiles.

### 768–1023px

- Navigation may collapse.
- Hero remains two columns only if content fits; otherwise stack.
- Collage reduces to three images.
- Card grids use two columns.

### Below 768px

- Single-column hero.
- Headline appears before collage.
- Collage becomes a two-column mini-grid.
- CTAs stack or wrap without clipping.
- Cards become one column.
- Drawers become full-screen panels.
- No horizontal scrolling at 375px.

---

## 12. Visual Acceptance Checklist

- [ ] The first viewport clearly communicates Hanoi tourism.
- [ ] Headline and CTA are visible without scrolling.
- [ ] Red, blue and jade are used consistently.
- [ ] There is no gradient or generic glass effect.
- [ ] Hero collage remains readable at all breakpoints.
- [ ] No text is embedded inside content images.
- [ ] All interactive controls have hover, focus and disabled states.
- [ ] Mobile layout has no horizontal overflow.
- [ ] Body text remains at least 16px.
- [ ] Keyboard focus is visible.

