# 02 — Product Specification

## 1. Product Summary

Hanoi Local is an interactive travel guide that lets visitors browse Hanoi food and attractions, search and filter results, register an account, save Favorites and assemble one simple one-day itinerary.

### Primary audience

- First-time visitors to Hanoi.
- Travellers with limited planning time.
- Users who want local food and heritage suggestions.

### Primary value

    Discover → Save → Plan

The site is not a booking platform and not a news/event portal.

---

## 2. Success Criteria

The project is successful when a new user can:

1. Understand the product from the Home page.
2. Find a Food or Place with search/filter.
3. Register and log in.
4. Save an item to Favorites.
5. Add Food and Places to Morning, Afternoon or Evening.
6. Reload and see their saved data.

The complete demo flow must take under five minutes.

---

## 3. Scope and Priorities

### P0 — Required for submission

- Home, Food, Places and Account interfaces.
- API-driven catalogue.
- Search, filter and sort.
- Register, login and logout.
- User-specific Favorites.
- User-specific My Day itinerary.
- Responsive layout.
- Loading, error and empty states.

### P1 — Required for advanced-quality delivery

- Password hashing and protected routes.
- Detail modal.
- Image optimisation.
- Accessibility pass.
- API tests.
- Performance measurement.
- Short benchmark/stress report.

### P2 — Future development

- Vietnamese–English bilingual interface.
- Multiple itineraries.
- Map and route assistance.
- Live weather/events.
- Reviews and community tips.

No P2 feature starts until all P0 acceptance criteria pass.

---

## 4. Information Architecture

### Global navigation

- Home
- Food
- Places
- My Day
- Favorites
- Account / Sign in

### Routes

| Route | Purpose | Access |
|---|---|---|
| / | Home | Public |
| /food.html | Food catalogue | Public |
| /places.html | Places catalogue | Public |
| /account.html | Register/login | Public |
| Favorites drawer | Saved items | Authenticated |
| My Day drawer | Itinerary | Authenticated |

---

## 5. User Stories

### Browsing

- As a visitor, I want to see representative Hanoi content immediately.
- As a visitor, I want Food and Places separated so that browsing is simple.
- As a visitor, I want to open a detail view without losing my current filters.

### Search and filter

- As a visitor, I want to search by name.
- As a visitor, I want to combine category, district and price/admission filters.
- As a visitor, I want to clear all filters with one action.

### Account

- As a new user, I want to register with a username and password.
- As a returning user, I want to log in and retrieve saved data.
- As a user, I want to log out from any page.

### Favorites

- As a logged-in user, I want to save interesting Food and Places.
- As a user, I want Favorite state to remain correct across pages.

### My Day

- As a logged-in user, I want to add an item to Morning, Afternoon or Evening.
- As a user, I want to reorder or move items.
- As a user, I want to see total stops and estimated cost.

---

## 6. Feature Requirements

## F1 — Catalogue and detail

### Requirements

- Load spot data from GET /api/spots.
- Render at least 10 Food and 10 Places.
- Use one shared card-rendering approach.
- Detail view includes image, description, address, hours, price, duration and local tip.
- Google Maps opens as an external link; no embedded map API.

### Acceptance

- Refreshing the page does not duplicate cards.
- Broken API displays an error with Retry.
- Missing optional data does not break card layout.
- Detail modal closes by button, Escape and overlay.

## F2 — Search, filter and sort

### Food filters

- Text search.
- Category.
- District.
- Price level.
- Sort: recommended, rating, price.

### Places filters

- Text search.
- Category.
- District.
- Free/paid admission.
- Duration.
- Sort: recommended, rating, duration.

### Acceptance

- Search is case-insensitive.
- All active filters use AND logic.
- Result count is correct.
- Clear filters restores initial order and items.
- Empty state contains a Clear filters action.

## F3 — Authentication

### Registration

- Username: 3–20 characters.
- Password: minimum 6 characters.
- Username is unique.
- Password is hashed.
- Success redirects or transitions to logged-in state.

### Login

- Correct credentials create a session.
- Incorrect credentials show a generic error.
- Header reflects auth state.

### Logout

- Session is destroyed.
- Private drawers close.
- Public browsing continues.

### Acceptance

- Frontend never receives password_hash.
- Protected API returns 401 for guests.
- Validation exists on frontend and backend.
- Buttons show submitting state.

## F4 — Favorites

### Requirements

- Add/remove Favorite from cards and detail modal.
- Favorite count appears in the header.
- Drawer groups or labels Food and Places.
- State persists after reload and later login.
- Database prevents duplicate pairs.

### Acceptance

- Same user cannot create duplicate Favorite.
- Different users have separate data.
- Removing an item updates all matching controls.

## F5 — My Day

### Requirements

- Add item to Morning, Afternoon or Evening.
- Prevent duplicate spots.
- Move item between slots.
- Move item up/down within a slot.
- Remove one item.
- Reset all with confirmation.
- Display total stops and estimated cost.

### Acceptance

- Different users have separate itineraries.
- Order remains correct after reload.
- Guest receives login prompt.
- Reset cannot happen accidentally.

---

## 7. Content Specification

### Food record minimum

- id
- name
- category
- district
- priceLevel
- rating
- shortDescription
- description
- image
- address
- openingHours
- localTip

### Place record minimum

- id
- name
- category
- district
- admission
- rating
- duration
- shortDescription
- description
- image
- address
- openingHours
- localTip

### Copy limits

- Card title: maximum approximately 45 characters.
- Short description: maximum 110 characters.
- Detail description: 1–2 short paragraphs.
- Local tip: one useful sentence.

---

## 8. State Matrix

Every major surface must define:

| State | Expected UI |
|---|---|
| Loading | Skeleton or compact loading indicator |
| Success | Data/cards rendered |
| Empty | Explanation + recovery action |
| Error | Clear message + Retry |
| Guest | Public content + login prompt for private actions |
| Authenticated | Favorites/My Day available |
| Submitting | Disabled button + progress text |

---

## 9. Non-functional Requirements

- No horizontal overflow at 375px.
- Main content usable at 200% browser zoom.
- Keyboard navigation supports nav, filters, forms and modal.
- Images use explicit dimensions or aspect-ratio.
- Page remains usable if animation is disabled.
- No password or session secret in frontend source.
- No unhandled errors in browser/server console during the demo.

---

## 10. Future Development

### Priority 1 — Bilingual Vietnamese–English

- Global EN/VI control.
- Translate navigation, forms, filter labels, content, Favorites and My Day.
- Persist preference in localStorage.
- Re-render dynamic content on change.
- Add name_vi/name_en and description_vi/description_en fields or a translation object.

This is explicitly excluded from the final submission scope unless all P0 and P1 work is complete.

