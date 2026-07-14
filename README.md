# GenY Super-App Backend

> Backend for a **ride-hailing + food-delivery super-app** that competes with Uber, Uber Eats, Careem, and Talabat.
>
> Built with **NestJS + PostgreSQL + TypeORM + Redis + Google Maps + Stripe + Firebase FCM + WebSockets** for live tracking.

## Architecture

```
src/
├── main.ts                       — bootstrap, Swagger, global pipes/filters
├── app/                           — root module + common (guards, decorators, filters, interceptors)
│   ├── app.module.ts
│   ├── config/                    — typed config loaders + env validation
│   └── common/
│       ├── decorators            — @Roles, @CurrentUser
│       ├── guards                — JWT guard (verifies token + enforces @Roles)
│       ├── filters               — global exception filter → uniform JSON errors
│       └── interceptors          — wraps success response as { success, data }
├── infra/                         — third-party integrations
│   ├── database/                  — TypeORM module + data-source + seed
│   ├── redis/                     — location cache + nearby-driver GEO queries
│   ├── google-maps/               — distance matrix, directions, fare estimator
│   ├── stripe/                    — payment intent, refund, webhook verify
│   └── fcm/                       — Firebase push notifications
└── modules/                       — domain modules (each is its own bounded context)
    ├── auth/                      — register / login / refresh / me
    ├── users/                     — profile + wallet + FCM token + (admin) list
    ├── drivers/                   — status, location ping, nearby, vehicles
    ├── restaurants/               — CRUD, status (OPEN/CLOSED/BUSY)
    ├── menu/                      — categories + items
    ├── trips/                     — ride-hailing: request, accept, status flow, fare calc
    ├── orders/                    — food delivery: cart, checkout, status machine
    ├── payments/                  — Stripe intents + webhook
    ├── ratings/                   — rate drivers / restaurants (auto-aggregates)
    ├── notifications/             — push notifications (FCM-backed)
    └── tracking/                  — WebSocket gateway for live location + status updates
```

## Roles

`CUSTOMER`, `DRIVER`, `RESTAURANT`, `ADMIN` — mutually exclusive per user. One account = one role.

## API

Base URL: `http://localhost:3000/api/v1` — Swagger: `http://localhost:3000/docs`

### Auth
| Method | Path | Body | Role |
|---|---|---|---|
| POST | `/auth/register` | `{ email, phone, firstName, lastName, password, role? }` | public |
| POST | `/auth/login` | `{ identifier, password }` | public |
| POST | `/auth/refresh` | `{ refreshToken }` | public |
| GET  | `/auth/me` | — | any authenticated |

### Customers (passenger app)
| Method | Path | Body |
|---|---|---|
| POST | `/trips` | `{ pickupLat, pickupLng, pickupAddress, destinationLat, destinationLng, destinationAddress, passengerCount? }` — returns fare estimate |
| POST | `/orders` | `{ restaurantId, items: [{ menuItemId, quantity }], deliveryAddress, deliveryLat, deliveryLng }` |
| GET  | `/trips/me`, `/orders/me`, `/restaurants`, `/restaurants/:id/categories`, `/restaurants/:id/items` |
| PATCH| `/trips/:id/status` | `{ status: "CANCELLED" }` (only while REQUESTED/ACCEPTED) |
| POST | `/ratings` | Submit a rating |
| GET  | `/drivers/nearby?lat=&lng=&radiusKm=5` | See available drivers on map |

### Drivers (driver app)
| Method | Path | Body |
|---|---|---|
| POST | `/drivers/me/online` | Start broadcasting location |
| POST | `/drivers/me/offline` | Stop broadcasting |
| POST | `/drivers/me/ping` | `{ lat, lng, heading? }` — call every 5-10s |
| POST | `/drivers/me/vehicles` | Register vehicle (plate, make, model, year, type) |
| POST | `/trips/:id/accept` | Accept a ride request |
| PATCH | `/trips/:id/status` | Flow: DRIVER_ARRIVING → DRIVER_ARRIVED → STARTED → COMPLETED |
| PATCH | `/orders/:id/status` | Flow: PICKED_UP → ON_THE_WAY → DELIVERED (only if assigned) |

### Restaurants (Flutter restaurant console or API)
| Method | Path | Body |
|---|---|---|
| POST   | `/restaurants` | Register |
| PATCH  | `/restaurants/:id` | Update status/info |
| POST   | `/restaurants/:id/categories` | Add menu category |
| POST   | `/restaurants/:id/items` | Add item |
| GET    | `/orders/restaurant/:restaurantId` | Incoming orders |
| PATCH  | `/orders/:id/status` | ACCEPTED / PREPARING / READY / REJECTED (auto-assigns nearest FOOD driver when READY) |

### Payments
| Method | Path | Body |
|---|---|---|
| POST | `/payments/intent` | `{ purpose: 'TRIP' \| 'ORDER', referenceId, amount, description? }` — returns Stripe `clientSecret` |
| POST | `/payments/:id/refund` | `{ amount? }` |
| POST | `/payments/webhook` | Stripe raw body + signature |

### Real-time (WebSocket)
Connect to `ws://localhost:3000/tracking` (Socket.IO namespace `tracking`)

Events (client → server):
- `auth` `{ token }`  — authenticate the socket (optional if handshake-auth sent)
- `join`   `{ room }`  — e.g. `trip:<id>`, `order:<id>`, `driver:<userId>`
- `driver:location` `{ lat, lng, heading?, tripId?, orderId? }`  — driver broadcasts position

Events (server → client):
- `trip:location`, `trip:update`
- `order:location`, `order:update`
- `driver:offer` — incoming request broadcast to a driver's room

## Fare model (ride-hailing)

Generated by `GoogleMapsService.estimateFare` using Uber-style formula:

```
fare = (baseFare + perKm * km + perMin * min) * surge
default: baseFare=2.50, perKm=1.20, perMin=0.25, surge=1.0
```

Surge ratio is currently hard-coded to 1.0. In production, compute from ratio of active
requests to nearby online drivers (managed in Redis).

## Driver matching

1. Drivers ping `/drivers/me/ping` every 5–10s, which writes their location to
   `Redis GEOADD drivers:geo lng lat driverId`.
2. When a trip is requested, `TripsService.findNearestDriverForTrip` runs
   `GEORadius drivers:geo pickup pickup, RADIUS 5km, ASC, 10`.
3. First driver with status `ONLINE` and `type ∈ {RIDE, BOTH}` is offered.
4. In production the matching engine runs asynchronously (BullMQ), broadcasts the offer
   over the WS channel to the driver, and waits for accept with a 10s timeout before
   cascading to the next candidate.

For food orders, the same flow starts from the moment the order transitions to `READY`.

## Run

### 1. Prerequisites

- Node 18+
- PostgreSQL 14+
- Redis 6+
- Google Maps API key with **Distance Matrix + Directions + Geocoding** enabled
- Stripe account (test mode keys)
- (Optional) Firebase project for FCM push

### 2. Install

```bash
npm install
```

### 3. Configure

```bash
cp .env.example .env
# edit DB / JWT / GOOGLE_MAPS_API_KEY / STRIPE_* / FIREBASE_*
```

### 4. Start dev server

```bash
npm run start:dev
```

This will:
- Connect to Postgres, run TypeORM `synchronize: true` (creates tables for MVP — disable in prod)
- Connect to Redis
- Listen on `http://localhost:3000`

### 5. Seed demo data

```bash
npm run seed
```

Creates 4 demo accounts (admin / customer / driver / restaurant) and a sample restaurant with menu.

Demo passwords for all accounts: **`P@ssw0rd`**

| Role     | Email                |
|----------|----------------------|
| Admin    | admin@geny.app       |
| Customer | customer@geny.app    |
| Driver   | driver@geny.app      |
| Restaurant | burgers@geny.app   |

### 6. Swagger

Open `http://localhost:3000/docs` and `Authorize` with the bearer token from `/auth/login`.

## Build & deploy

```bash
npm run build
npm run start:prod     # node dist/main.js
```

Use TypeORM migrations in production (disable `DB_SYNC`):

```bash
npm run migration:generate
npm run migration:run
```

## Using the app — step by step

The repo is a monorepo: a **NestJS backend**, a **Flutter mobile app** (serves
Customers, Drivers, and Restaurant partners from one codebase via role-based
routing), and a **React admin dashboard**. Follow the steps below to run the
whole thing locally and exercise every role.

### 0. Prerequisites

- Node 18+
- Flutter 3.13+ and an emulator/simulator (or physical device)
- PostgreSQL 14+ and Redis 6+ — easiest via Docker:

  ```bash
  docker compose up -d          # starts postgres + redis from docker-compose.yml
  ```

  (Bring your own Postgres/Redis and edit `.env` if you prefer.)

### 1. Start the backend

```bash
npm install
cp .env.example .env           # if you don't already have a .env
npm run start:dev              # or: npm run build && npm run start:prod
```

- Listens on `http://localhost:3000` (Swagger at `http://localhost:3000/docs`).
- No real API keys needed for a local demo: with `GOOGLE_MAPS_API_KEY` blank the
  distance/fare uses a haversine fallback, and `STRIPE_SECRET_KEY=sk_test_xxx`
  makes the payment service return mock intents. Set real keys in `.env` for
  production-like behavior.

### 2. Seed demo accounts

```bash
npm run seed
```

Creates four accounts (password **`P@ssw0rd`** for all):

| Role        | Email              |
|-------------|--------------------|
| Admin       | admin@geny.app     |
| Customer    | customer@geny.app  |
| Driver      | driver@geny.app    |
| Restaurant  | burgers@geny.app   |

`burgers@geny.app` owns the seeded "GenY Burger House" and its menu.

### 3. Run the mobile app

```bash
cd passenger_app
flutter pub get
flutter run                 # choose an emulator / device / simulator
```

- The API URL defaults to `http://10.0.2.2:3000/api/v1` (Android emulator).
  For an **iOS simulator** use localhost, and for a **physical device** use your
  machine's LAN IP. Override with:

  ```bash
  flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1
  flutter run --dart-define=API_BASE_URL=http://192.168.x.x:3000/api/v1
  ```

- After login, the app routes you to the correct home by your role
  (Customer → passenger, Driver → driver, Restaurant → restaurant console).

### 4. Walk through each role

**Customer (passenger)**
1. Log in as `customer@geny.app`.
2. Request a ride (pickup + destination) → see a fare estimate → place the trip.
3. Food: browse restaurants → open a menu → add items → **Checkout** (mock Stripe
   PaymentIntent) → track the order.
4. View ride/order history and your profile from the bottom nav.

**Driver**
1. Log in as `driver@geny.app`.
2. Tap **Go online** — the app pings your location every 10s and subscribes to
   live offers over WebSocket.
3. Accept an incoming trip offer; advance status
   `DRIVER_ARRIVING → DRIVER_ARRIVED → STARTED → COMPLETED`.
4. Food deliveries: when a restaurant marks an order `READY`, a delivery offer
   arrives; advance `PICKED_UP → ON_THE_WAY → DELIVERED`.

**Restaurant partner**
1. Log in as `burgers@geny.app` (RESTAURANT role) — the app opens the
   restaurant console.
2. **Orders** tab: see incoming orders and **Accept / Reject / Mark Preparing /
   Mark Ready**. Marking an order `READY` auto-assigns the nearest available
   FOOD driver.
3. **Menu** tab: **Add category**, **Add item** (name, price, description),
   toggle item availability, and delete items.

**Admin (web dashboard)**
1. ```bash
   cd admin_dashboard
   npm install
   npm run dev                 # opens http://localhost:5173
   ```
   Vite proxies `/api` → `http://localhost:3000`, so no extra config is needed.
2. Log in with `admin@geny.app` / `P@ssw0rd`.
3. Browse **Trips**, **Orders**, **Payments**, and **Ratings** across all users.

### 5. (Optional) Automated smoke test

With the backend running and infrastructure up (Docker), validate the API:

```bash
npm run smoke                 # node scripts/smoke-test.mjs
```

### Notes

- Live tracking uses the WebSocket at `ws://localhost:3000/tracking`; the Flutter
  app defaults to `ws://10.0.2.2:3000/tracking` (override with
  `--dart-define=WS_BASE_URL=...`).
- `DB_SYNC=true` auto-creates tables for the MVP. For production, disable it and
  use `npm run migration:generate` / `npm run migration:run`.

## Tech stack summary

| Concern              | Tool                                     |
|----------------------|------------------------------------------|
| Framework            | NestJS 10                                |
| Language             | TypeScript 5                              |
| ORM                  | TypeORM 0.3                              |
| DB                   | PostgreSQL 14+                            |
| Cache / Geo          | Redis 4 (node-redis)                       |
| Auth                 | @nestjs/jwt (self-contained guard)         |
| Maps                 | Google Maps Platform REST (Distance Matrix/Directions/Geocoding) |
| Payments             | Stripe (PaymentIntents + webhooks)         |
| Push                 | Firebase Admin FCM                          |
| Real-time            | @nestjs/websockets + socket.io (Redis adapter recommended for scaling) |
| API docs             | @nestjs/swagger (OpenAPI 3)                |
| Rate limit           | @nestjs/throttler                          |
| Test                 | Jest                                       |

## Roadmap (things explicitly outside this MVP)

- BullMQ-based async matching engine (currently synchronous within request)
- Multi-driver bidding / cascade-offer pattern
- Surge pricing computed from livedemand
- Scheduling, trip-share, ride-pool
- Restaurant-facing live order dashboard socket bridge
- Amazon S3 / Cloudinary for image uploads (placeholders only)
- KYC / document upload for driver onboarding
- Multi-language / multi-currency
- Admin dashboard (separate web app)
- Docker / Kubernetes manifests

## License

MIT
