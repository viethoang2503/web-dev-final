# 04 — Task Breakdown and Team Ownership

## 1. Working Model

The plan supports up to seven members. Each member has:

- One primary ownership area.
- One review responsibility.
- One demo topic they must explain.

No member works only on slides or only on data entry.

### Task sizing

- S: under half a focused day.
- M: approximately one focused day.
- L: multiple focused sessions or high integration risk.

These are relative sizes, not deadlines.

---

## 2. Suggested Team Roles

| Member | Primary ownership | Review responsibility |
|---|---|---|
| M1 | Tech lead + shared UI | Backend API contracts |
| M2 | Home page | Responsive consistency |
| M3 | Food page | Data/content quality |
| M4 | Places + detail modal | Accessibility |
| M5 | Backend auth | Frontend forms |
| M6 | Favorites + My Day | Database integrity |
| M7 | QA, performance, docs | Full integration |

If the team has fewer than seven members:

- Merge M1 and M2.
- Merge M3 and M4.
- Merge M7 into M5/M6 after core backend is stable.

---

## 3. Phase 0 — Project Foundation

| ID | Task | Owner | Size | Depends on | Acceptance |
|---|---|---|---|---|---|
| SET-01 | Initialise Node/Express project | M1 | S | None | Server starts; public folder loads |
| SET-02 | Establish folder structure | M1 | S | SET-01 | Matches Technical Spec |
| SET-03 | Add CSS design tokens | M1 | S | SET-02 | Colors/type/spacing reusable |
| SET-04 | Create SQLite schema | M5 | M | SET-01 | Tables and constraints exist |
| SET-05 | Create repeatable seed data | M3 + M4 | M | SET-04 | 10 Food + 10 Places |
| SET-06 | Define shared API response format | M1 + M5 | S | SET-01 | Documented and used by first route |

### Gate 0

Do not start personal features until:

- Server starts on a clean checkout.
- Database seeds correctly.
- GET /api/spots returns data.
- One sample card renders in the browser.

---

## 4. Phase 1 — Shared UI and Public Pages

### M1 — Shared UI

| ID | Task | Size | Acceptance |
|---|---|---|---|
| UI-01 | Header + utility bar | M | Desktop/mobile nav works |
| UI-02 | Footer | S | Consistent across pages |
| UI-03 | Shared button/card styles | M | States documented |
| UI-04 | Modal and drawer foundations | M | Keyboard close and focus |
| UI-05 | Responsive base styles | M | 375/768/1024/1440 |

### M2 — Home

| ID | Task | Size | Acceptance |
|---|---|---|---|
| HOME-01 | Editorial hero | L | Matches Design Style |
| HOME-02 | Hanoi collage | M | Responsive, no overlap |
| HOME-03 | Three category tiles | M | Links work |
| HOME-04 | Featured Food/Places | M | Renders API data |
| HOME-05 | Planner CTA | S | Auth-aware action |

### M3 — Food

| ID | Task | Size | Acceptance |
|---|---|---|---|
| FOOD-01 | Food page shell | M | Header/content/footer |
| FOOD-02 | Food card rendering | M | Shared data-driven function |
| FOOD-03 | Search | S | Case-insensitive |
| FOOD-04 | Category/district/price filters | M | Combined AND logic |
| FOOD-05 | Sort and result count | S | Correct and stable |
| FOOD-06 | Empty/error states | S | Recovery action present |

### M4 — Places

| ID | Task | Size | Acceptance |
|---|---|---|---|
| PLACE-01 | Places page shell | M | Header/content/footer |
| PLACE-02 | Place card rendering | M | Shared card conventions |
| PLACE-03 | Search/filter/sort | M | Matches Product Spec |
| PLACE-04 | Detail modal | L | Full content + keyboard |
| PLACE-05 | External map link | S | Safe new-tab behaviour |

### Gate 1

- Home visually represents the mockup direction.
- Food and Places render from API data.
- Filters work on desktop and mobile.
- Modal is keyboard accessible.
- No horizontal overflow at 375px.

---

## 5. Phase 2 — Authentication

### M5 — Backend authentication

| ID | Task | Size | Depends on | Acceptance |
|---|---|---|---|---|
| AUTH-01 | Registration endpoint | M | SET-04 | Validation + unique username |
| AUTH-02 | Password hashing | M | AUTH-01 | No plaintext storage |
| AUTH-03 | Login endpoint | M | AUTH-02 | Session created |
| AUTH-04 | Current-user endpoint | S | AUTH-03 | Public user fields only |
| AUTH-05 | Logout endpoint | S | AUTH-03 | Session destroyed |
| AUTH-06 | requireAuth middleware | M | AUTH-03 | Returns 401 for guest |

### M1/M5 — Account UI

| ID | Task | Owner | Size | Acceptance |
|---|---|---|---|---|
| FORM-01 | Register form | M1 | M | Labels + inline validation |
| FORM-02 | Login form | M1 | M | Error/submitting states |
| FORM-03 | Header auth state | M1 | M | Sign in/account/logout |
| FORM-04 | Auth integration | M5 | M | Session survives reload |

### Gate 2

- Register creates hashed user.
- Duplicate username returns 409.
- Login updates header.
- Logout removes protected access.
- No password hash reaches frontend.

---

## 6. Phase 3 — Favorites and My Day

### M6 — Favorites

| ID | Task | Size | Depends on | Acceptance |
|---|---|---|---|---|
| FAV-01 | Favorite database queries | M | AUTH-06 | User-specific |
| FAV-02 | Favorite endpoints | M | FAV-01 | GET/POST/DELETE |
| FAV-03 | Favorite button integration | M | FAV-02 | All controls sync |
| FAV-04 | Favorites drawer | M | UI-04 | Food/Places visible |
| FAV-05 | Guest login prompt | S | FORM-04 | No silent failure |

### M6 + M2 — My Day

| ID | Task | Owner | Size | Depends on | Acceptance |
|---|---|---|---|---|---|
| DAY-01 | Itinerary queries | M6 | M | AUTH-06 | Ordered per user |
| DAY-02 | Itinerary endpoints | M6 | L | DAY-01 | CRUD works |
| DAY-03 | Add-to-slot UI | M2 | M | DAY-02 | 3 slots |
| DAY-04 | My Day drawer | M2 | L | UI-04 | Responsive |
| DAY-05 | Move/remove/reset | M2 + M6 | L | DAY-04 | Persists |
| DAY-06 | Totals calculation | M2 | S | DAY-04 | Stops + cost |

### Gate 3

- Two accounts show different saved data.
- Duplicate Favorite and itinerary items are rejected.
- Reload retains state.
- Logout hides personal data.

---

## 7. Phase 4 — Quality, Performance and Delivery

### M7 — QA lead

| ID | Task | Size | Acceptance |
|---|---|---|---|
| QA-01 | API test checklist | M | All endpoints covered |
| QA-02 | End-to-end demo flow | M | Under five minutes |
| QA-03 | Responsive pass | M | Four target widths |
| QA-04 | Keyboard/accessibility pass | M | Core flow keyboard-only |
| QA-05 | Browser/server console pass | S | No unhandled errors |
| QA-06 | Bug triage list | S | Owner + severity + status |

### Performance

| ID | Task | Owner | Size | Acceptance |
|---|---|---|---|---|
| PERF-01 | Convert images to WebP | M7 + content owners | M | Size comparison recorded |
| PERF-02 | Lazy-load below fold | M2–M4 | S | Hero excluded |
| PERF-03 | Reserve image space | M1 | S | No obvious layout shift |
| PERF-04 | API benchmark | M7 | M | 1/20/50 concurrency table |

### Delivery

| ID | Task | Owner | Size | Acceptance |
|---|---|---|---|---|
| DOC-01 | Setup README | M1 | M | New machine can run |
| DOC-02 | Architecture slide | M5 | S | Request flow shown |
| DOC-03 | Feature/demo slide | M2–M4 | S | 5 features |
| DOC-04 | Results slide | M7 | S | Tests/performance evidence |
| DOC-05 | Q&A sheet | All | M | Everyone answers basics |

---

## 8. Git and Collaboration Rules

- One task ID per branch when possible.
- Branch names: feature/FOOD-04-filters, fix/QA-03-mobile-overflow.
- Pull request or merge review by at least one other member.
- Do not merge code that fails the current phase gate.
- Do not rewrite another member's working area without coordination.
- Keep commits focused and messages tied to task IDs.
- Resolve integration daily rather than at the end.

---

## 9. Risk Register

| Risk | Impact | Prevention | Fallback |
|---|---|---|---|
| Authentication consumes too much time | High | Scope to username/password/session | Keep forms simple; no recovery |
| Merge conflicts in shared CSS | Medium | M1 owns tokens/components | Page styles stay scoped |
| Inconsistent data | Medium | One schema + seed owner | Validate seed before merge |
| Images slow the site | Medium | WebP + sizes + lazy load | Reduce gallery count |
| Itinerary UI becomes complex | High | Up/down buttons, no drag/drop | Remove reordering, keep slot change |
| Demo network issue | Medium | Same-origin local app | Prepare screenshots/video backup |
| Random presenter struggles | High | Shared Q&A rehearsal | One-page cheat sheet |

---

## 10. Final Definition of Done

Code and evidence:

- [x] Every P0 requirement passes — Home, Food, Places, Account, API catalogue,
      search/filter/sort, register/login/logout, per-user Favorites, per-user My
      Day, responsive layout, and loading/error/empty states are all built and
      covered by automated checks.
- [x] Five feature groups can be demonstrated — catalogue and detail, search and
      filter, authentication, Favorites, My Day.
- [x] Database can be recreated from instructions — `npm run db:reset` and
      `npm run db:demo-reset`, verified from a clean checkout on a second path.
- [x] No critical or high bug remains — 343 automated assertions pass and the
      browser and server consoles are asserted clean.
- [x] Demo account and seed data are ready — `demo` and `demo2`, each with
      Favorites and a My Day plan.
- [x] Performance and testing evidence is available — see docs/05 sections 2, 4,
      5 and 6.

Team work still to do (not code):

- [ ] Every member has completed one primary task and one review. The code
      currently comes from one build pass; split the remaining Phase 4 items
      (photography, slides, rehearsal) so every member owns something and
      reviews something.
- [ ] Demo completes in under five minutes — rehearse three times with a timer.
- [ ] All members understand the auth, Favorites and My Day flow — walk through
      docs/05 section 9 together; the answers are written out there.

### Phase 4 status

| Task | Status |
|---|---|
| QA-01 API test checklist | Done, as `qa:auth` and `qa:data` |
| QA-02 end-to-end demo flow | Script written in docs/05 section 8, not yet rehearsed |
| QA-03 responsive pass | Done, `qa:responsive`, 4 pages × 4 widths |
| QA-04 keyboard and accessibility pass | Done, `qa:a11y`, 78 checks |
| QA-05 console pass | Done, asserted on every page in every browser suite |
| QA-06 bug triage list | Not needed: no open bugs. Everything found was fixed in the same pass |
| PERF-01 convert images to WebP/AVIF | Tooling done (`npm run assets:webp`), photographs outstanding |
| PERF-02 lazy-load below the fold | Done, asserted against real element positions |
| PERF-03 reserve image space | Done, CLS under 0.1 on Home and Food |
| PERF-04 API benchmark | Done, docs/05 section 6 |
| DOC-01 setup README | Done and verified from a clean checkout |
| DOC-02 architecture slide | Outstanding |
| DOC-03 feature/demo slide | Outstanding |
| DOC-04 results slide | Outstanding, numbers ready in docs/05 |
| DOC-05 Q&A sheet | Done, docs/05 section 9 with written answers |

