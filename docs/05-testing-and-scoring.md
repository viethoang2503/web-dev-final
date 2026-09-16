# 05 — Testing, Evidence and Scoring Strategy

## 1. Purpose

The evaluation brief mentions complete interface, essential features and advanced functions such as optimisation, benchmarking and stress testing. This document turns those requirements into observable evidence.

This is not an invented official score distribution. It is a strategy for showing the strongest work during a short presentation.

---

## 2. Functional Test Matrix

### Public catalogue

| Case | Expected result |
|---|---|
| Home loads | Hero, category tiles and featured content appear |
| API is temporarily unavailable | Error state and Retry appear |
| Food page loads | Food only |
| Places page loads | Places only |
| Open detail | Correct record shown |
| Escape from detail | Modal closes and focus returns |

### Search/filter/sort

| Case | Expected result |
|---|---|
| Search “pho” | Matching item found regardless of case |
| Select district + price | AND logic |
| Change sort | Active filters remain |
| No match | Empty state + Clear filters |
| Clear filters | Complete initial list |

### Authentication

| Case | Expected result |
|---|---|
| Valid registration | User/session created |
| Duplicate username | 409 + inline error |
| Short password | Frontend and backend reject |
| Wrong password | Generic login error |
| Valid login | Header changes |
| Logout | Personal UI closes |
| Protected API as guest | 401 |

### Favorites

| Case | Expected result |
|---|---|
| Guest clicks heart | Login prompt |
| User adds Favorite | Heart/count/drawer update |
| User adds duplicate | No duplicate row |
| User removes Favorite | All instances update |
| Reload | Saved state remains |
| Login as second user | Separate Favorites |

### My Day

| Case | Expected result |
|---|---|
| Add item to Morning | Item appears |
| Add same spot again | Rejected with feedback |
| Move Morning to Afternoon | Slot persists |
| Move item up/down | Position persists |
| Remove item | Totals update |
| Reset | Confirmation required |
| Login as second user | Separate itinerary |

---

## 3. Responsive Test Matrix

Test widths:

- 375px — mobile.
- 768px — tablet portrait.
- 1024px — small desktop/tablet landscape.
- 1440px — design target.

At each width verify:

- Header and menu.
- Hero headline wrapping.
- Collage image clipping.
- CTA wrapping.
- Filter controls.
- Card columns.
- Modal/drawer size.
- Form labels/errors.
- No horizontal scrolling.

---

## 4. Accessibility Evidence

### Required checks

- Navigate main flow using Tab, Shift+Tab, Enter, Space and Escape.
- Visible focus on links, buttons and fields.
- Form labels connected using for/id.
- Heart button has state-aware aria-label.
- Modal has a meaningful accessible name.
- Images have appropriate alt text.
- Decorative blocks/images use empty alt or CSS.
- Error is not conveyed by color alone.
- Body text contrast is at least 4.5:1.
- Touch targets are at least 44 × 44px.

### Presentation evidence

Spend 10–15 seconds navigating one interaction without a mouse. This demonstrates accessibility more convincingly than a slide full of claims.

---

## 5. Performance Optimisation

### Image optimisation

For representative images record:

| Asset | Before | After WebP | Reduction |
|---|---:|---:|---:|
| Hero Lake | TBD | TBD | TBD |
| Pho card | TBD | TBD | TBD |
| Temple card | TBD | TBD | TBD |

Implementation:

- WebP or AVIF.
- Responsive dimensions where practical.
- width/height or aspect-ratio.
- loading="lazy" below the first viewport.
- Hero images load normally.

### Frontend efficiency

- Render from data rather than duplicated markup.
- Use one event listener pattern where reasonable.
- Avoid full-page re-render for one Favorite change.
- Cache DOM references used repeatedly.
- Do not attach duplicated listeners after every filter.

---

## 6. Benchmark and Stress Test

### Targets

Use read-only endpoints:

- GET /api/spots.
- GET /api/spots?kind=food.
- GET /api/spots?kind=place.

Authenticated endpoints may be benchmarked only if the test session is controlled.

### Scenarios

- 1 request.
- 20 concurrent requests.
- 50 concurrent requests.

### Metrics

| Concurrency | Total | Success | Failed | Avg ms | Max ms |
|---:|---:|---:|---:|---:|---:|
| 1 | TBD | TBD | TBD | TBD | TBD |
| 20 | TBD | TBD | TBD | TBD | TBD |
| 50 | TBD | TBD | TBD | TBD | TBD |

### Rules

- Run tests on the same machine/environment.
- Run each scenario more than once and report representative results.
- Do not claim production scalability.
- Do not stress register/login routes and pollute the database.
- Explain that this is a classroom benchmark for comparison.

---

## 7. Extra-mark Evidence Map

| Evaluation opportunity | Implementation | Evidence |
|---|---|---|
| Complete interface | Home/Food/Places/Account + states | Live responsive demo |
| Essential features | Catalogue, filters, auth | Main user flow |
| 4–5 main features | 5 documented feature groups | Feature summary slide |
| Advanced backend | Sessions, hashing, user ownership | Architecture diagram |
| Performance | WebP, lazy load, stable image space | Before/after table |
| Benchmark | API timings | Concurrency table |
| Stress testing | 20/50 request tests | Success/failure metrics |
| Accessibility | Keyboard, labels, focus, contrast | Keyboard demo |
| Reliability | Validation and error handling | Show duplicate/error case |
| Code quality | Modules, shared render, middleware | Folder/flow diagram |

---

## 8. Presentation Script

### 0:00–0:40 — Problem and product

- Visitors need one place to discover local food and meaningful places.
- Hanoi Local supports Discover → Save → Plan.

### 0:40–1:10 — Architecture

- HTML/CSS/JavaScript frontend.
- Node.js/Express API.
- SQLite persistence.
- Session-based accounts.

### 1:10–2:00 — Authentication

- Register.
- Explain hashed password.
- Show logged-in header.

### 2:00–2:45 — Discovery

- Open Food.
- Search Pho.
- Apply one filter.
- Mention shared rendering.

### 2:45–3:30 — Favorites

- Save Pho.
- Open Favorite drawer.
- Explain user-specific database row.

### 3:30–4:40 — My Day

- Add breakfast/food to Morning.
- Add Place to Afternoon.
- Move or remove one item.
- Show totals.

### 4:40–5:10 — Persistence

- Reload.
- Confirm Favorite and My Day remain.

### 5:10–5:40 — Quality

- Resize or show mobile view.
- Keyboard-focus demo.
- Show optimisation/benchmark table.

### 5:40–6:10 — Future

- Bilingual EN/VI.
- Multiple trips.
- Map/route suggestions.

### 6:10–7:00 — Q&A buffer

Do not spend presentation time browsing every card.

---

## 9. Q&A Preparation

Every member should answer:

1. Why is Node.js needed?
2. What is the difference between authentication and authorisation?
3. Why hash passwords?
4. Why use sessions instead of storing login in localStorage?
5. How does the backend know which user's Favorites to load?
6. How do combined filters work?
7. Why is search done in frontend?
8. How is duplicate data prevented?
9. What was optimised and how was it measured?
10. Why was bilingual moved to future development?

### Short answer for bilingual

The group prioritised a stable end-to-end product with real authentication and persisted personal data. Bilingual support is planned through structured translation fields and local preference storage after core requirements are complete.

---

## 10. Final Release Checklist

- [ ] Seed database reset and test accounts prepared.
- [ ] Correct demo user credentials recorded privately for presenters.
- [ ] Main flow rehearsed three times.
- [ ] No console/server error during rehearsal.
- [ ] Mobile layout checked.
- [ ] Benchmark numbers inserted.
- [ ] Image optimisation numbers inserted.
- [ ] Backup screenshots available.
- [ ] README startup steps verified by a second member.
- [ ] All presenters can explain the architecture diagram.

