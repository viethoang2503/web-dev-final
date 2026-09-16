# 03 — Technical Specification

## 1. Stack

- Frontend: semantic HTML5, CSS3, vanilla JavaScript.
- Backend: Node.js and Express.
- Database: SQLite.
- Authentication: session-based.
- Password hashing: bcrypt-compatible package.
- Communication: fetch() with JSON.

Avoid frontend frameworks so every member can explain the DOM and JavaScript behaviour.

---

## 2. Proposed Repository Structure

    web-application/
    ├── public/
    │   ├── index.html
    │   ├── food.html
    │   ├── places.html
    │   ├── account.html
    │   ├── css/
    │   │   ├── tokens.css
    │   │   ├── base.css
    │   │   ├── components.css
    │   │   └── pages.css
    │   ├── js/
    │   │   ├── api.js
    │   │   ├── auth.js
    │   │   ├── cards.js
    │   │   ├── filters.js
    │   │   ├── favorites.js
    │   │   ├── itinerary.js
    │   │   ├── modal.js
    │   │   └── main.js
    │   └── assets/
    ├── server/
    │   ├── routes/
    │   ├── middleware/
    │   ├── services/
    │   └── db/
    ├── tests/
    ├── server.js
    ├── package.json
    ├── .env.example
    └── README.md

---

## 3. Responsibility Boundaries

### api.js

- Contains fetch wrapper.
- Adds common headers.
- Parses JSON.
- Normalises errors.
- Never contains DOM rendering.

### cards.js

- Creates Food/Place card markup.
- Receives data as input.
- Does not fetch data directly.

### filters.js

- Owns filter state.
- Applies search, filters and sorting.
- Re-renders via a supplied callback.

### auth.js

- Loads current user.
- Handles register/login/logout.
- Updates header auth UI.

### favorites.js

- Calls Favorite endpoints.
- Holds the currently loaded Favorite IDs.
- Synchronises heart buttons.

### itinerary.js

- Calls itinerary endpoints.
- Renders Morning/Afternoon/Evening.
- Handles add, move, remove and reset.

---

## 4. Database Schema

### users

    id INTEGER PRIMARY KEY AUTOINCREMENT
    username TEXT NOT NULL UNIQUE
    password_hash TEXT NOT NULL
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### spots

    id TEXT PRIMARY KEY
    kind TEXT NOT NULL CHECK(kind IN ('food', 'place'))
    name TEXT NOT NULL
    short_description TEXT NOT NULL
    description TEXT NOT NULL
    category TEXT NOT NULL
    district TEXT NOT NULL
    price_level INTEGER
    admission INTEGER
    rating REAL
    duration_minutes INTEGER
    image_url TEXT NOT NULL
    address TEXT
    opening_hours TEXT
    local_tip TEXT
    featured INTEGER NOT NULL DEFAULT 0

### favorites

    user_id INTEGER NOT NULL
    spot_id TEXT NOT NULL
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    PRIMARY KEY (user_id, spot_id)

### itinerary_items

    id INTEGER PRIMARY KEY AUTOINCREMENT
    user_id INTEGER NOT NULL
    spot_id TEXT NOT NULL
    time_slot TEXT NOT NULL CHECK(time_slot IN ('morning', 'afternoon', 'evening'))
    position INTEGER NOT NULL
    UNIQUE(user_id, spot_id)

Use foreign keys where supported and enable foreign-key enforcement.

---

## 5. API Contract

### Response envelope

Successful list:

    {
      "data": [],
      "meta": {
        "count": 0
      }
    }

Successful object:

    {
      "data": {}
    }

Error:

    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Please check the submitted fields."
      }
    }

Do not expose stack traces or SQL errors to the browser.

### Public endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/spots | Return all spots |
| GET | /api/spots?kind=food | Return Food |
| GET | /api/spots?kind=place | Return Places |
| GET | /api/spots/:id | Return one spot |

### Auth endpoints

| Method | Endpoint | Body | Result |
|---|---|---|---|
| POST | /api/auth/register | username, password | Create user/session |
| POST | /api/auth/login | username, password | Create session |
| POST | /api/auth/logout | none | Destroy session |
| GET | /api/auth/me | none | Current public user data |

### Favorite endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/favorites | Current user list |
| POST | /api/favorites/:spotId | Add one |
| DELETE | /api/favorites/:spotId | Remove one |

### Itinerary endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/itinerary | Load current itinerary |
| POST | /api/itinerary/items | Add item |
| PATCH | /api/itinerary/items/:id | Change slot/position |
| DELETE | /api/itinerary/items/:id | Remove item |
| DELETE | /api/itinerary | Reset itinerary |

---

## 6. Authentication and Security

### Session

- Store only user ID and minimal session information.
- Cookie must be httpOnly.
- Use sameSite=lax.
- secure=true in production HTTPS.
- Session secret comes from environment variables.
- Never commit the real secret.

### Passwords

- Hash before insert.
- Compare using the hashing library.
- Never log raw passwords.
- Never return password_hash.
- Use generic invalid-login message.

### Validation

- Validate username/password on frontend for feedback.
- Repeat validation on backend for security.
- Validate all IDs and enum fields.
- Use parameterised SQL statements.
- Return 400, 401, 404, 409 and 500 appropriately.

### Protected middleware

Authenticated routes must use one shared middleware:

    requireAuth → route handler

The backend derives user_id from the session; never trust a user_id supplied by the browser.

---

## 7. Frontend Data Flow

### Page load

    DOMContentLoaded
    → load current user
    → request spots
    → render cards
    → if authenticated, load Favorites and itinerary

### Favorite action

    user click
    → verify auth state
    → disable button
    → POST or DELETE
    → update local Favorite set
    → synchronise matching buttons
    → show feedback

### Itinerary action

    user click Add to My Day
    → verify auth
    → choose time slot
    → POST item
    → refresh drawer state
    → show success or duplicate error

---

## 8. Search and Filter Algorithm

Use frontend filtering because the dataset is small.

Recommended sequence:

    original data
    → filter by page kind
    → filter by search term
    → filter by selected chips/selects
    → sort a copy
    → render

Requirements:

- Never mutate the original array when sorting.
- Normalise strings with lowercase and trim.
- Debounce text search only if needed; simple input is acceptable for 20 records.
- Active filters are the single source of truth.

---

## 9. Error Handling

### Frontend

- api.js throws a consistent application error.
- Page-level load errors show Retry.
- Form errors appear near fields.
- Protected-action 401 opens login prompt.
- Network errors use a neutral message.

### Backend

- Central 404 handler.
- Central error middleware.
- Log internal details on server only.
- Return stable error codes for frontend branching.

---

## 10. Environment Variables

.env.example should document:

    PORT=3000
    SESSION_SECRET=replace-with-a-long-secret
    DATABASE_PATH=./server/db/hanoi-local.sqlite

The real .env must not be committed.

---

## 11. Definition of Technical Done

- [ ] npm start launches the application.
- [ ] Static assets and API share one origin.
- [ ] Database can be created from documented steps.
- [ ] Seed script produces repeatable demo content.
- [ ] All endpoints return the documented shape.
- [ ] Protected endpoints return 401 for guests.
- [ ] Passwords are hashed.
- [ ] No raw secret exists in repository files.
- [ ] No unhandled promise rejection appears during demo.
- [ ] Setup instructions work on another member's computer.

