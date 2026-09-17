# 05 — Testing, Evidence and Scoring Strategy

## 1. Purpose

The evaluation brief mentions complete interface, essential features and advanced functions such as optimisation, benchmarking and stress testing. This document turns those requirements into observable evidence.

This is not an invented official score distribution. It is a strategy for showing the strongest work during a short presentation.

---

## 2. Functional Test Matrix

Every case below is automated. `npm run qa` runs all of it against a running
server and prints one PASS or FAIL line per case, so the matrix is a live
checklist rather than something to tick by hand.

| Script | Covers | Cases |
|---|---|---:|
| `npm run qa:responsive` | No horizontal overflow, clean console, on 4 pages × 4 widths | 16 |
| `npm run qa:catalogue` | Search, filters, sort, empty state, detail modal, guest prompt | 35 |
| `npm run qa:auth` | Auth API, password hashing evidence, `requireAuth` | 47 |
| `npm run qa:account` | Register/login forms, header auth state, session persistence | 40 |
| `npm run qa:data` | Favorites and itinerary API, two accounts side by side, ownership | 67 |
| `npm run qa:drawers` | Both drawers in a browser, heart syncing, move/remove/reset | 45 |
| `npm run qa:a11y` | Contrast, targets, labels, headings, keyboard path | 78 |
| `npm run qa:perf` | Lazy loading, layout shift, render efficiency | 15 |
| | **Total** | **343** |

Last full run: 343 passed, 0 failed. Missing photography is reported separately
and is not counted as a failure, because the placeholder fallback is intended
behaviour until PERF-01 is done.

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

    node tests/a11y-check.mjs

78 checks across the four pages plus a keyboard walk-through. Result: all pass.

### Required checks and where they are proven

| Check | Status | Evidence |
|---|---|---|
| Tab, Shift+Tab, Enter, Escape through the main flow | Pass | Script tabs to a card, opens the modal with Enter, closes with Escape |
| Visible focus on links, buttons and fields | Pass | Stylesheet is scanned for a `:focus-visible` outline rule and for any rule that removes one |
| Form labels connected with for/id | Pass | Accessible name resolved the way a browser does, for every visible control |
| Heart button has a state-aware aria-label | Pass | `qa:drawers` asserts the label flips between "Save X" and "Remove X" |
| Modal has a meaningful accessible name | Pass | `aria-labelledby` resolves to a real element |
| Images have appropriate alt text | Pass | Every `img` carries an `alt` attribute |
| Decorative blocks use empty alt or CSS | Pass | Collage colour blocks are `<span>` with `aria-hidden`; tile images use `alt=""` |
| Error is not conveyed by colour alone | Pass | `.field__error` prints a text message with an icon, and sets `aria-invalid` |
| Body text contrast at least 4.5:1 | Pass | Contrast computed per element against its effective background, 3:1 for large text |
| Touch targets at least 44 × 44 | Pass | Measured from rendered boxes; card links are measured by their stretched hit area |
| Heading levels never skip | Pass | Heading outline walked per page |
| No positive tabindex | Pass | Checked per page |
| prefers-reduced-motion honoured | Pass | Stylesheet contains the media query; motion tokens collapse to 1 ms |

### Three real fixes this pass produced

The audit was not decorative; it found and led to fixing:

1. `.card__summary` was 14 px. It is body copy that visitors actually read, so
   it is now 16 px, matching the Design Style rule that body text never goes
   below 16 px.
2. The short navigation link "Food" was 37 px wide. Nav links now have
   horizontal padding and a 44 px minimum in both directions.
3. The show/hide password button was 36 px tall. It is now 44 px, still inside
   the 48 px field.

### What automation cannot cover

Nothing here replaces using the site with a screen reader, or judging whether a
label reads sensibly out loud. The script proves the mechanical rules hold.

### Presentation evidence

Spend 10–15 seconds navigating one interaction without a mouse: Tab to a card,
Enter to open it, Escape to close, and point out that focus lands back on the
card you started from. That is more convincing than a slide full of claims.

---

## 5. Performance Optimisation

### Image optimisation

Run the converter, then paste its table here:

    node tests/optimise-images.mjs <folder-with-originals>

It writes AVIF using the `sips` tool built into macOS, or WebP when `cwebp` is
installed, and prints before/after sizes per file plus a total. Either format is
fine: the app references images without a file extension and
`server/middleware/images.js` serves whichever one exists.

Measured on a sample conversion of a 2000px source (real photography pending):

| Asset | Before | After AVIF | Reduction |
|---|---:|---:|---:|
| Sample 2000px source | 91.5 KB | 7.3 KB | 92% |

Fill in the real table once the 24 photos are in place. Current status is
reported by `node tests/perf-check.mjs`, which counts how many references still
fall back to the placeholder.

Implementation status:

- [x] AVIF or WebP, chosen by whichever encoder the machine has.
- [x] Long edge capped per role: 1600px hero, 1200px cards and tiles.
- [x] Every image declares width/height or inherits an aspect-ratio, verified by
      `tests/perf-check.mjs`.
- [x] `loading="lazy"` on everything below the first viewport, verified against
      the element's real position rather than by eye.
- [x] Hero collage images load eagerly.
- [x] Missing photos fall back to the placeholder server-side with an
      `X-Image-Placeholder` header, so the layout never depends on the browser's
      error handling.
- [ ] The 24 real photographs (PERF-01, content work).

### Layout stability

Cumulative Layout Shift is measured in `tests/perf-check.mjs` with a
`PerformanceObserver` while the cards load. Current result is under the 0.1
"good" threshold, because the card image box reserves its space with
`aspect-ratio` and skeletons occupy the same box as the real cards.

### Frontend efficiency, verified rather than claimed

`tests/perf-check.mjs` asserts each of these:

| Claim | How it is checked |
|---|---|
| Filtering replaces cards, never appends | Card count drops when a filter narrows, returns to exactly the original count when cleared |
| No duplicated listeners after repeated filtering | After four filter passes, one card click opens the modal exactly once |
| One Favorite change does not re-render the grid | Every card is tagged, a heart is toggled, and all tags survive |

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

### How to reproduce

    npm start                    # in one terminal
    node tests/benchmark.mjs     # in another

200 requests per scenario, three runs per scenario, median reported.

### Results

Measured on Apple Silicon (darwin arm64), Node v26.7.0, over loopback against
SQLite with 20 rows.

| Endpoint | Concurrency | Total | Success | Failed | Avg ms | p95 ms | Max ms | Req/s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `GET /api/spots` | 1 | 200 | 200 | 0 | 0.37 | 0.74 | 1.64 | 2659 |
| `GET /api/spots` | 20 | 200 | 200 | 0 | 5.56 | 9.52 | 17.15 | 3460 |
| `GET /api/spots` | 50 | 200 | 200 | 0 | 12.06 | 15.40 | 27.91 | 3750 |
| `GET /api/spots?kind=food` | 1 | 200 | 200 | 0 | 0.24 | 0.36 | 2.31 | 4090 |
| `GET /api/spots?kind=food` | 20 | 200 | 200 | 0 | 3.25 | 4.84 | 7.88 | 5883 |
| `GET /api/spots?kind=food` | 50 | 200 | 200 | 0 | 7.39 | 9.53 | 17.44 | 6039 |
| `GET /api/spots?kind=place` | 1 | 200 | 200 | 0 | 0.25 | 0.39 | 0.97 | 3943 |
| `GET /api/spots?kind=place` | 20 | 200 | 200 | 0 | 3.61 | 5.83 | 9.15 | 5288 |
| `GET /api/spots?kind=place` | 50 | 200 | 200 | 0 | 7.02 | 8.44 | 15.68 | 5717 |

### How to read this

- No request failed at any concurrency level, so nothing breaks under load.
- Latency grows roughly in proportion to concurrency while throughput stays
  flat at a few thousand requests per second. That is exactly what a single
  Node process at its throughput ceiling looks like: requests queue rather than
  fail, so each one waits longer.
- The full catalogue is slower than the filtered ones because the response is
  twice the size. The work is serialising JSON, not querying SQLite.

### One measurement trap worth mentioning

The first version of this benchmark reported a p95 of about 200 ms while the
median was 4 ms. That was not the server. Requests were going to `localhost`,
which is dual-stack, and opening many connections at once made some of them wait
on the IPv6-to-IPv4 fallback timer. The benchmark now targets `127.0.0.1` and
reuses keep-alive sockets, so the numbers describe the API rather than the
client's connection setup.

### Rules followed

- Same machine and environment for every scenario.
- Three runs per scenario, median reported.
- Read-only endpoints only. Register and login are never stressed, so the
  database stays clean.
- No claim about production scalability. This is a classroom comparison on one
  laptop.

---

## 7. Extra-mark Evidence Map

| Evaluation opportunity | Implementation | Evidence to show |
|---|---|---|
| Complete interface | Home, Food, Places, Account, two drawers, detail modal | Resize the window live; 16 viewport checks pass |
| Essential features | Catalogue from API, search, filters, sort, auth | Main user flow in under five minutes |
| 4–5 main features | Catalogue, search/filter, auth, Favorites, My Day | Feature summary slide |
| Advanced backend | Session store written on SQLite, bcrypt hashing, per-user ownership | Architecture diagram plus the `sessions` table on screen |
| Performance | AVIF/WebP pipeline, lazy loading, reserved image space, CLS under 0.1 | `node tests/perf-check.mjs` output |
| Benchmark | 1/20/50 concurrency on three endpoints | Table in section 6 |
| Stress testing | 200 requests per scenario, zero failures | Success/failure columns |
| Accessibility | Keyboard path, labels, focus, contrast, 44 px targets | Keyboard demo plus 78 passing checks |
| Reliability | Validation on both sides, central error envelope, duplicate handling | Show a duplicate username and a duplicate My Day item |
| Code quality | One shared card renderer, one fetch wrapper, one auth gate, one pricing table | Folder and request-flow diagram |
| Testing depth | 342 automated assertions, no framework installed | Run `npm run qa` live if there is time |

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

Every member should be able to answer all ten. Learn the idea, not the wording.

**1. Why is Node.js needed? Could this not be pure HTML and JavaScript?**

Three things need code that the visitor cannot see or change. Passwords must be
hashed and compared somewhere the browser cannot reach. Sessions must be stored
somewhere the browser cannot forge. And one user's Favorites must be invisible
to another user. A browser-only site would have to keep all of that in the
browser, which means anyone could read or edit it. Node also gives us one origin
serving both the pages and the API, so there is no CORS to configure.

**2. What is the difference between authentication and authorisation?**

Authentication is "who are you", authorisation is "are you allowed to do this".
`POST /api/auth/login` is authentication. `requireAuth` on
`/api/favorites` is authorisation at the route level. Checking that an itinerary
item id belongs to the session's user before moving it is authorisation at the
record level. We do both: passing the first does not automatically pass the
second.

**3. Why hash passwords instead of encrypting or storing them?**

Hashing is one-way, so even we cannot read a password back out of the database.
When someone logs in, we hash what they typed and compare hashes. Encryption
would be reversible, which means a leaked key leaks every password. We use
bcrypt at cost 10, which is deliberately slow, so guessing at scale is
expensive. You can see it in the database: every `password_hash` starts with
`$2b$10$`.

**4. Why sessions instead of keeping the login in localStorage?**

Anything in localStorage is readable by any JavaScript on the page, so one
cross-site scripting bug leaks it. Our session id lives in an httpOnly cookie,
which JavaScript cannot read at all, and the cookie only holds an id; the real
session data sits in the `sessions` table on the server. It is also
`sameSite=lax`, so it is not sent on cross-site requests. Nothing sensitive
exists in the frontend to steal.

**5. How does the backend know whose Favorites to load?**

From the session, never from the request. `requireAuth` reads
`req.session.userId`, loads that user, and attaches it as `req.user`. The
Favorites query is `WHERE user_id = ?` with that value. A user id sent in a body
or query string is ignored everywhere in the project. That is why trying to
touch another account's itinerary item returns 404: the query never matches.

**6. How do combined filters work?**

`filters.js` holds one state object with the search term and every selected
value. On any change, the pipeline runs in a fixed order: filter by search, then
by each active filter with AND logic, then sort a copy of the result, then
render. The original array is never mutated, which is why clearing the filters
restores the exact starting order. The DOM only reflects that state; it is never
the source of truth.

**7. Why is search done on the frontend?**

Twenty records. All of them are already in memory after the first request, so
filtering locally is instant and costs no extra requests, while a server round
trip per keystroke would be slower and pointless. If the catalogue grew to
thousands of rows the honest answer would change: we would move filtering into
SQL with an index, because shipping the whole table to the browser would stop
being reasonable.

**8. How is duplicate data prevented?**

By the database, not by an `if` in JavaScript. `favorites` has
`PRIMARY KEY (user_id, spot_id)` and `itinerary_items` has
`UNIQUE (user_id, spot_id)`. A second insert cannot succeed even if two clicks
race each other. The code catches the constraint error and turns it into a 409
with a readable message, rather than checking first and hoping nothing changes
in between.

**9. What was optimised, and how was it measured?**

Images: sources are capped at 1600 px on the long edge and converted to AVIF or
WebP, roughly a 90% reduction on a sample file. Everything below the first
viewport is lazy-loaded, and every image box reserves its space, so Cumulative
Layout Shift stays under 0.1. Rendering: one delegated listener per grid instead
of one per card, so filtering repeatedly does not multiply listeners, and a
single Favorite change updates buttons instead of rebuilding the grid. All of it
is asserted by `tests/perf-check.mjs`, not eyeballed. The API side is in
section 6: no failed requests at 50 concurrent, and latency that grows with
concurrency while throughput stays flat, which is what a saturated single Node
process looks like.

**10. Why was bilingual moved to future development?**

We chose one product that works end to end over two half-finished languages. A
proper bilingual version is not string swapping: it needs translated fields in
the database, a persisted preference, and re-rendering of dynamic content. The
groundwork is already in place, though: the Vietnamese font subset is bundled,
and the language control in the header is visible but explicitly marked as
future rather than faked.

### If asked something you do not know

Say what you do know, say what you have not checked, and say where you would
look. Guessing is worse than a bounded answer.

---

## 10. Final Release Checklist

Done:

- [x] Seed database reset and demo accounts prepared — `npm run db:demo-reset`
      creates `demo` and `demo2`, both with Favorites and a My Day plan already
      in them, and it is safe to re-run.
- [x] Demo credentials recorded: `demo / hanoi2026` and `demo2 / hanoi2026`.
      Throwaway credentials for the presentation only.
- [x] No console or server error during the automated runs — 342 assertions,
      and the console is asserted clean on every page.
- [x] Mobile layout checked at 375, 768, 1024 and 1440, signed in and signed
      out.
- [x] Benchmark numbers inserted — section 6.
- [x] Image pipeline and measurement method inserted — section 5.
- [x] Setup verified from a clean checkout: copied only the git-tracked files
      into an empty folder, then `npm install`, `npm run db:reset`,
      `npm run db:demo`, `npm start`. Catalogue, login and the demo plan all
      worked, and no `.env` or database file came along.

Still to do before the presentation:

- [ ] The 24 real photographs (PERF-01). Run
      `node tests/optimise-images.mjs <folder>` and paste its table into
      section 5. Until then every image falls back to the placeholder, which is
      reported by `node tests/perf-check.mjs`.
- [ ] Main flow rehearsed three times, timed under five minutes.
- [ ] Backup screenshots or a screen recording, in case of a demo failure.
- [ ] Architecture and results slides (DOC-02 to DOC-04).
- [ ] Every presenter has read section 9 and can answer all ten questions.

### Ten minutes before presenting

    npm run db:demo-reset    # clean database, demo accounts with data
    npm start                # leave this running, do not restart it
    npm run qa               # optional, if you want a green run on screen

Sessions survive a restart because they live in SQLite, but there is no reason
to test that on stage.

