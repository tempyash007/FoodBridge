# FoodBridge API — Postman Testing Guide

## Setup

1. Start the server: `npm run dev` in `d:\FoodBridge`
2. Base URL: `http://localhost:3000`
3. In Postman, cookies are enabled by default — no extra setup needed.

> [!IMPORTANT]
> Always **Login or Register first**. Tokens are set as cookies automatically — all subsequent requests work without any manual copy-pasting.

---

## Auth Endpoints

### 1. Register
**`POST /api/auth/register`**

Body (raw JSON):
```json
{
  "email": "donor@test.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe",
  "role": "DONOR",
  "phone": "9999999999"
}
```
✅ Expect: `201` — user + tokens in response. Cookies set automatically.

---

### 2. Login
**`POST /api/auth/login`**

Body:
```json
{
  "email": "donor@test.com",
  "password": "password123"
}
```
✅ Expect: `200` — user + tokens. Cookies refreshed.

---

### 3. Get Current User
**`GET /api/auth/me`**

No body, no headers needed — cookie sent automatically.

✅ Expect: `200` — user object (no `password_hash`).

---

### 4. Refresh Token
**`POST /api/auth/refresh`**

No body needed.

✅ Expect: `200` — new `accessToken` in response + cookie updated.

---

### 5. Logout
**`POST /api/auth/logout`**

No body needed.

✅ Expect: `200` — cookies cleared. Subsequent protected requests will return `401`.

---

## Listing Endpoints

> [!NOTE]
> You must be logged in as a **DONOR** for create/update/delete/my endpoints.

---

### 6. Create Listing
**`POST /api/listings`**

Body:
```json
{
  "title": "Fresh Vegetables",
  "description": "Freshly harvested mixed vegetables",
  "quantity": 10,
  "quantity_unit": "kg",
  "estimated_servings": 20,
  "expiry_time": "2026-03-30T18:00:00Z",
  "pickup_start": "2026-03-24T09:00:00Z",
  "pickup_end": "2026-03-24T12:00:00Z",
  "street_address": "123 MG Road",
  "city": "Ahmedabad",
  "state": "Gujarat",
  "postal_code": "380001",
  "country": "India",
  "latitude": 23.0225,
  "longitude": 72.5714,
  "image_urls": [
    "https://example.com/img1.jpg",
    "https://example.com/img2.jpg"
  ]
}
```
✅ Expect: `201` — listing + address + images. **Copy the `listing_id`** for next tests.

---

### 7. Browse All Listings
**`GET /api/listings`**

No body. Optional query params:

| Param | Example |
|-------|---------|
| `city` | `?city=Ahmedabad` |
| `category_id` | `?category_id=<uuid>` |
| `status` | `?status=ACTIVE` (default) |
| `page` | `?page=1` |
| `limit` | `?limit=10` |

Example URL: `http://localhost:3000/api/listings?city=Ahmedabad&page=1&limit=5`

✅ Expect: `200` — list of listings + pagination info.

---

### 8. Get My Listings
**`GET /api/listings/my`**

No body needed (donor cookie sent automatically).

✅ Expect: `200` — all listings created by the logged-in donor.

---

### 9. Get Single Listing
**`GET /api/listings/:id`**

Replace `:id` with the `listing_id` from step 6.

Example: `http://localhost:3000/api/listings/your-listing-id-here`

✅ Expect: `200` — full listing with all images + category info.

---

### 10. Update Listing
**`PUT /api/listings/:id`**

Only include fields you want to change:
```json
{
  "title": "Updated Title",
  "quantity": 15,
  "description": "Updated description"
}
```
✅ Expect: `200` — updated listing.
❌ With a different user's token: `403 Forbidden`.

---

### 11. Delete (Cancel) Listing
**`DELETE /api/listings/:id`**

No body needed.

✅ Expect: `200` — listing with `status: "CANCELLED"`.
❌ With wrong user: `403 Forbidden`.

---

## Error Cases to Verify

| Test | Expected |
|------|----------|
| Register with existing email | `409 Conflict` |
| Login with wrong password | `401 Unauthorized` |
| Access protected route after logout | `401 Unauthorized` |
| Create listing with `quantity: -5` | `400 Bad Request` |
| Create listing with past `expiry_time` | `400 Bad Request` |
| Create listing with `pickup_end` before `pickup_start` | `400 Bad Request` |
| Update/delete listing you don't own | `403 Forbidden` |
| Get listing with invalid ID | `404 Not Found` |

---

## Donor Portal Endpoints

> [!NOTE]
> You must be logged in as a **DONOR** (cookies auto-sent after login/register).

---

### 12. Donor Dashboard
**`GET /api/donor/dashboard`**

No body needed.

✅ Expect: `200` — response contains:
- `stats` — meals_saved, co2_prevented_kg, active_listings, waste_diverted_kg
- `active_listings` — each with dietary_tags array
- `pickup_requests` — volunteer name, listing title, mission status

---

### 13. Donation History
**`GET /api/donor/history`**

No body. Optional query params:

| Param | Example |
|-------|---------|
| `page` | `?page=1` |
| `limit` | `?limit=10` |

Example URL: `http://localhost:3000/api/donor/history?page=1&limit=5`

✅ Expect: `200` — list of delivered donations with `listing_title`, `date`, `quantity`, `recipient_org`, `rating` + pagination.

---

### 14. Export History as CSV
**`GET /api/donor/history/export`**

No body needed.

✅ Expect: `200` — CSV file download with headers:
```
Listing Title,Date,Quantity,Unit,Recipient Org,Rating
```
💡 **Postman tip:** Click **Send and Download** to save the CSV file.

---

### 15. Impact Dashboard
**`GET /api/donor/impact`**

No body needed.

✅ Expect: `200` — response contains:
- `totals` — meals_saved, co2_prevented_kg, waste_diverted_kg
- `weekly_trend` — array of last 7 days, each with `day`, `meals_saved`, `waste_diverted_kg`

---

## Donor Portal Error Cases

| Test | Expected |
|------|----------|
| Access donor endpoints as RECIPIENT/VOLUNTEER | `403 Forbidden` |
| Access donor endpoints without login | `401 Unauthorized` |
| Dashboard with no impact_metrics row | `200` — zeros for all stats |
| History with no delivered listings | `200` — empty array |

---

## Recipient Portal Endpoints

> [!NOTE]
> You must be logged in as a **RECIPIENT** (cookies auto-sent after login/register).

---

### 16. Browse Listings
**`GET /api/recipient/browse`**

No body. Query params:

| Param | Example | Required | Default |
|-------|---------|----------|---------|
| `lat` | `23.03` | ✅ | — |
| `lng` | `72.58` | ✅ | — |
| `radius_km` | `5` | ❌ | `5` |
| `category_id` | `?category_id=<uuid>` | ❌ | — |
| `dietary_tags` | `?dietary_tags=Vegan,Halal` | ❌ | — |
| `sort` | `nearest` \| `expiring_soon` \| `highest_rated` | ❌ | `nearest` |
| `search` | `?search=vegetable` | ❌ | — |
| `page` | `?page=1` | ❌ | `1` |
| `limit` | `?limit=10` | ❌ | `10` |

Example URL: `http://localhost:3000/api/recipient/browse?lat=23.03&lng=72.58&radius_km=5&sort=nearest&page=1&limit=10`

✅ Expect: `200` — response contains:
- `total` — count of matching listings
- `radius_km` — applied radius
- `listings` — each with `listing_id`, `title`, `donor_org`, `quantity`, `quantity_unit`, `estimated_servings`, `expiry_time`, `minutes_until_expiry`, `distance_km`, `category`, `dietary_tags[]`, `status`

---

### 17. Claim a Listing
**`POST /api/recipient/claims`**

Body:
```json
{
  "listing_id": "your-listing-id-here",
  "pickup_time": "2026-03-30T10:00:00Z"
}
```
✅ Expect: `201` — the created claim object with `status: "PENDING"`. Listing status changes to `claimed`.
❌ Listing already claimed: `409 Conflict` — "Already claimed".
❌ Listing not available / doesn't exist: `400 Bad Request` — "Listing not available".

---

### 18. My Claimed Items
**`GET /api/recipient/claims`**

No body needed.

✅ Expect: `200` — response contains:
- `claims` — array of all claims (active + completed), each with:
  - `claim_id`, `listing_title`, `donor_org`, `quantity`, `quantity_unit`
  - `claim_status` — PENDING, PICKED_UP, DELIVERED, CANCELLED
  - `mission_status` — assigned, en_route, delivered (or `null` if no mission yet)
  - `volunteer_name` — e.g. "Sarah K." (or `null`)
  - `est_duration_min`, `pickup_time`

---

### 19. Cancel a Claim
**`DELETE /api/recipient/claims/:claim_id`**

Replace `:claim_id` with the `claim_id` from step 17.

Example: `http://localhost:3000/api/recipient/claims/your-claim-id-here`

No body needed.

✅ Expect: `200` — claim set to `CANCELLED`, listing restored to `available`.
❌ Claim not PENDING (already picked up): `400 Bad Request` — "Only pending claims can be cancelled".
❌ Claim doesn't exist or not yours: `404 Not Found`.

---

### 20. Submit a Review
**`POST /api/recipient/reviews`**

Body:
```json
{
  "mission_id": "your-mission-id-here",
  "rating": 4,
  "comment": "Great volunteer!"
}
```
✅ Expect: `201` — the created review object.
❌ Already reviewed this mission: `409 Conflict` — "You have already reviewed this mission".
❌ Rating not 1–5: `400 Bad Request`.
❌ Mission not found / not yours: `400 Bad Request`.

---

## Recipient Portal Error Cases

| Test | Expected |
|------|----------|
| Access recipient endpoints as DONOR/VOLUNTEER | `403 Forbidden` |
| Access recipient endpoints without login | `401 Unauthorized` |
| Browse without `lat` and `lng` | `400 Bad Request` |
| Browse with no listings in radius | `200` — empty array |
| Claim an already-claimed listing | `409 Conflict` |
| Claim a non-existent listing | `400 Bad Request` |
| Cancel an already picked-up claim | `400 Bad Request` |
| Cancel someone else's claim | `404 Not Found` |
| Review same mission twice | `409 Conflict` |
| Review with rating 0 or 6 | `400 Bad Request` |
