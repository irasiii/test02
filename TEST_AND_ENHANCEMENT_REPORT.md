# GenY Super-App — Functional Test & Enhancement Report

**Date:** 2026-07-14
**Scope:** NestJS backend (`src/`) — every domain module exercised against a live Postgres + Redis stack in a cloud sandbox.
**Bottom line:** The backend booted, but a live end-to-end pass surfaced **10 real bugs** (2 of them security holes). All are now fixed. The suite went from **34/52 → 52/52** live checks passing, plus **153/153** Jest unit tests (one new test added).

---

## How it was tested

I stood up real PostgreSQL 14 and Redis, built the app, seeded the demo data, and ran two layers of tests:

1. **Jest unit tests** — the repo's existing 152 service specs (all green), plus one I added.
2. **A new live end-to-end script** (`scripts/e2e-full.mjs`, 52 assertions) that drives real HTTP + WebSocket traffic through every module: auth, users, drivers, restaurants, menu, trips (full ride lifecycle), orders (full delivery lifecycle), payments, ratings, and the Socket.IO tracking gateway — including negative/authorization cases.

The unit tests passed from the start; every bug below was invisible to them because they mock the database and never boot the Nest container. They only showed up under real traffic.

---

## Bugs found and fixed

### Security (high priority)

1. **Anyone could self-register as ADMIN.** `POST /auth/register` accepted a `role` field with no restriction, so `{"role":"ADMIN"}` minted a full admin account. **Fix:** `AuthService.register` now rejects `ADMIN` with a 403; ADMIN accounts can only come from the seed or another admin. Added a unit test covering this.

2. **Customers could drive another user's trip through the state machine.** `TripsService.updateStatus` only checked "is this the customer or the driver?" — but then let *either* set `STARTED`/`COMPLETED`, so a customer could self-complete a trip (triggering fare finalization and driver stat changes). **Fix:** `STARTED` and `COMPLETED` now require the assigned driver.

### Correctness — app wouldn't fully run without these

3. **App failed to boot: `UserRepository` not available in `DriversModule`.** The shared `JwtAuthGuard` injects the `User` repository, but `AuthModule` didn't export it, so every module using the guard failed dependency injection. **Fix:** `AuthModule` now exports `TypeOrmModule`.

4. **`GET /restaurants` threw 500 — `column r.is_active does not exist`.** The query builder used the DB column name (`is_active`) where TypeORM expects the entity property (`isActive`). **Fix:** corrected the query.

5. **Order creation threw 500 — `invalid input syntax for integer`.** `estimatedPrepMinutes` comes back from Postgres as a numeric string; adding it to a number produced a bad value for the integer `etaMinutes` column. **Fix:** coerce with `Number(...)` and round.

6. **Every relational read that used `relations: [...]` risked breaking; order/restaurant ownership checks silently failed.** Nine `@ManyToOne` relations were missing `@JoinColumn`, so TypeORM invented shadow FK columns (`customerId` alongside `customer_id`, etc.). Relations loaded as empty objects — which is why restaurant-owner authorization on orders returned 403 for the legitimate owner. **Fix:** added `@JoinColumn({ name: ... })` to all nine relations (orders ×5, trips ×2, payments, ratings, vehicle, menu ×2).

7. **`Restaurant.menuCategories` pointed at the wrong inverse side** (`category.restaurantId` instead of `category.restaurant`). **Fix:** corrected.

### API contract / usability

8. **`GET /restaurants/me` returned 500**, shadowed by `GET /restaurants/:id` declared above it — `me` was parsed as an `:id`. **Fix:** reordered so the literal route wins.

9. **Driver location ping (`POST /drivers/me/ping`) rejected valid payloads with 400.** `speedKmh` and `heading` were optional in intent but not marked `@IsOptional()`, so omitting them failed validation. **Fix:** added `@IsOptional()`.

10. **WebSocket location writes broke the nearby-driver query.** The REST ping stores drivers in Redis GEO keyed by `driver.id`, but the WS `driver:location` handler stored them keyed by `user:{userId}`. Mixed key formats made `GET /drivers/nearby` throw `invalid input syntax for uuid`. **Fix:** the gateway now resolves and caches `driver.id` per socket so both paths write the same key.

Also: `POST /auth/login` and `/auth/refresh` returned HTTP **201** (Nest's default for `@Post`) instead of **200** — corrected with `@HttpCode(200)`. And `payments/intent` now returns the internal `paymentId` so clients can fetch/refund without a second lookup.

---

## Verified working (all 52 live checks green)

Auth (login all roles, bad-password 401, token refresh, missing-token 401, admin-guard) · Users (profile update, admin-list authorization) · Restaurants (public list, by-id, owner `/me`) · Menu (list/add/update/delete categories & items, cross-owner block) · Drivers (online, ping, nearby, profile) · **Trip lifecycle** (request → fare estimate → accept → arriving → arrived → started → completed → final fare + driver stats; customer cancel; self-complete blocked) · **Order lifecycle** (create with totals, below-minimum reject, restaurant accept→preparing→ready, **auto-assign nearest food driver on READY**, driver picked-up→on-the-way→delivered) · Payments (mock Stripe intent, fetch, refund, admin list) · Ratings (rate driver/restaurant, aggregate recompute, list) · **WebSocket tracking** (driver→customer live location relay) · Admin cross-user views.

---

## Suggested next enhancements (not yet applied)

- **Authorization returns 401 where 403 is correct.** The shared guard throws `UnauthorizedException` (401) for insufficient role; an authenticated-but-wrong-role user should get 403. Worth splitting authn from authz.
- **`DB_SYNC=true` in production is risky** (already flagged in the README roadmap). The live run hit a `synchronize` column-rewrite error on an existing DB — a real preview of what auto-sync does to production data. Move to migrations.
- **Fix the out-of-sync `package-lock.json`** (`npm ci` fails — missing `passport@0.7.0`); run `npm install` and commit the lock.
- **Surge pricing is hard-coded to 1.0** and matching is synchronous — both already on the roadmap; the Redis GEO plumbing is in place to compute real surge.
