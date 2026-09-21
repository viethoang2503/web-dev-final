# Hanoi Local

A Hanoi city guide built with HTML, CSS and vanilla JavaScript, served by
Express with SQLite. Frontend and API share one origin; no frontend build step
or separate dependency installation is required.

## Quick start

Requires Node.js 22.5 or newer.

```sh
npm ci
npm run db:init
npm run db:seed
npm start
```

Open http://localhost:3000. For watch mode, run `npm run dev`.
Optionally copy `.env.example` to `.env`. Set a private `SESSION_SECRET`
before deploying. Relative `DATABASE_PATH` values resolve from this directory.

## Project structure

```text
frontend/public/
  index.html, food.html, places.html, account.html
  styles/                 Shared CSS and page layouts
  scripts/
    pages/                Page entry points (*.page.js)
    components/           Cards, dialogs and site layout
    features/             Favorites and itinerary interactions
    services/             API client and authentication
    utils/                Catalogue filter state
  assets/                 Fonts, icons and optimized images
  uploads/                User-supplied photographs
backend/
  src/
    server.js             Express entry point
    config/               Environment and path configuration
    routes/               API endpoints (*.routes.js)
    middleware/           Request middleware (*.middleware.js)
    services/             Business logic (*.service.js)
    database/             Schema, connection, seed and session store
    utils/                HTTP responses and API errors
  data/                   Local SQLite database (ignored by Git)
tests/
  helpers/                Shared browser test utilities
  *.test.mjs              Integration and browser tests
scripts/                  Asset optimization and API benchmarking
docs/                     Local documentation and mockups (ignored by Git)
```

Use lowercase kebab-case, with role suffixes where they add clarity. Keep HTML
page names and public routes stable. Root npm scripts are the supported entry
points for development, tests and database tasks.

## Database

- `npm run db:init`: apply the schema without deleting existing data.
- `npm run db:seed`: upsert the catalogue without deleting user data.
- `npm run db:demo`: rebuild the two presentation accounts.
- `npm run db:reset` / `db:demo-reset`: **destructive**, local demo use only.
  Stop the server first.

The default database is `backend/data/hanoi-local.sqlite`. If migrating an
existing checkout, update any custom `.env` that still points to `server/db/`.

## Verification

Run the server before running `npm run qa:catalogue`, `qa:auth`, `qa:data`,
`qa:account`, `qa:drawers`, `qa:a11y` or `qa:perf`.
Run `npm run qa:structure` without a server to validate imports, static assets
and npm script paths after moving or renaming files.
Browser tests require Chrome or Chromium. `npm run qa` runs the complete suite.
Home, Food and Places intentionally target desktop: legacy 375px assertions
in `qa:responsive` and `qa:account` are outside the current UI brief.

- `npm run benchmark`: API benchmark.
- `npm run assets:webp -- <source-directory>`: optimize image assets.

Detailed course notes, design references and test notes remain locally in
`docs/`. They are not included in a fresh clone.
