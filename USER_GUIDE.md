# GenY Super-App — User Guide

> Who each role is, and how to use the platform step by step: Passenger, Driver, Restaurant, Delivery, and Admin.

GenY is one platform with two services — **ride-hailing** and **food delivery** — served by two applications:

- The **GenY mobile app** (Flutter) — used by Passengers, Drivers, and Restaurant partners. Everyone logs into the same app; it opens the right experience for your account's role automatically.
- The **GenY Admin Console** (web) — used by platform administrators only, at `http://localhost:5173` in development.

Every account has exactly one role. For local demos, the seed script creates one ready-made account per role (password for all: **`P@ssw0rd`**):

| Role | Demo account | Where they work |
|---|---|---|
| Passenger (customer) | `customer@geny.app` | Mobile app |
| Driver | `driver@geny.app` | Mobile app |
| Restaurant partner | `burgers@geny.app` | Mobile app (restaurant console) |
| Admin | `admin@geny.app` | Web dashboard |

---

## 1. Passenger — the customer

**Who:** anyone who wants a ride or food delivered. This is the default role when you sign up.

**Getting started:** open the app → **Register** with your email, phone, name, and password (or log in). You land on the passenger home: a map centered on your location, showing available drivers nearby as markers.

### How to book a ride

1. On the home map, open the **ride request sheet**.
2. Confirm your **pickup** (defaults to your current location) and enter your **destination**.
3. The app shows a **fare estimate** before you commit — calculated as base fare 2.50 + 1.20 per km + 0.25 per minute.
4. Tap to **place the trip**. The system finds the nearest available driver within 5 km.
5. Once a driver accepts, you'll get a notification and can **track the driver live on the map** — their position and every status change (arriving → arrived → trip started → completed) update in real time.
6. On completion you see the **final fare** (recalculated from the actual route) and can **rate your driver** 1–5 stars.
7. You can **cancel** a trip any time before the driver picks you up.

### How to order food

1. From the home screen, tap the **food** shortcut to browse restaurants (open ones, sorted by rating; searchable by name or cuisine).
2. Open a restaurant → browse its **menu** by category → **add items to your cart**.
3. Go to **Checkout**: confirm your delivery address, review the price breakdown (items subtotal + delivery fee + 5% service fee + 5% tax), and pay by card (Stripe). Note each restaurant has a **minimum order** amount.
4. Track the order live through every stage: the restaurant accepting and preparing it, a courier being assigned, pickup, on-the-way (with the courier's live position on the map), and delivery.
5. After delivery, **rate the restaurant** (and courier).

Your **Rides** and **Orders** tabs keep your full history; the **Profile** tab manages your account.

---

## 2. Driver

**Who:** a person who drives passengers, delivers food, or both. Each driver profile has a type — **RIDE**, **FOOD**, or **BOTH** — that controls which jobs they're offered. New driver accounts start **unapproved** and must be approved before going online.

**Getting started:** register in the app choosing the **Driver** role (a driver profile is created automatically), then register your **vehicle** (plate, make, model, year, type) under your profile.

### How to work a shift

1. Tap **Go online**. From this moment you're visible to the platform: the app sends your GPS position every ~10 seconds, which keeps you on customers' maps and in the matching pool. You must be online to receive or accept any job.
2. **Ride jobs:** when a passenger nearby requests a trip, you receive the **offer** with pickup and destination. **Accept** it, then advance the trip as it actually happens, tapping through: **Arriving → Arrived → Start trip → Complete trip**. Only you (the assigned driver) can advance your trip. Completing it finalizes the fare, adds to your trip count, and returns you to the pool.
3. **Delivery jobs:** when a restaurant marks an order ready and you're the nearest available food driver, the delivery is **assigned to you** with the restaurant and drop-off details. Collect the food and tap through: **Picked up → On the way → Delivered**. Delivery adds to your delivery count and returns you to the pool.
4. Tap **Go offline** to end your shift — you disappear from the map and stop receiving offers.

Your **Deliveries** tab shows your job history; your rating (from passenger reviews) is shown on your profile and to customers.

---

## 3. Restaurant partner

**Who:** a food business selling on the platform. One account owns one restaurant, with its profile (name, location, delivery fee, minimum order, prep time, opening hours) and status: **OPEN**, **BUSY**, or **CLOSED** (a closed restaurant can't receive orders).

**Getting started:** log in with a Restaurant account — the app opens the **restaurant console** instead of the passenger view.

### How to manage your menu (Menu tab)

- **Add categories** (e.g. "Burgers", "Sides") to organize the menu.
- **Add items** under a category: name, price, description, and optional dietary flags (vegetarian / vegan / gluten-free) and prep time.
- **Toggle availability** on any item to hide it temporarily (e.g. sold out) without deleting it, or **delete** items and categories outright.
- Only you (or a platform admin) can modify your menu.

### How to handle orders (Orders tab)

Incoming orders appear with their items, total, and delivery address. For each order you decide:

1. **Accept** it (or **Reject** it) — the customer is notified either way.
2. Tap **Preparing** when the kitchen starts.
3. Tap **Ready** when the food is packed for pickup. **This is the important one:** marking Ready automatically dispatches the nearest available delivery driver to your restaurant — you don't arrange couriers yourself.
4. Hand the order to the courier when they arrive; from there the driver and the platform handle the rest.

Customer ratings of your restaurant aggregate into the score shown to everyone browsing.

---

## 4. Delivery — how an order travels

Delivery isn't a separate login — it's the handoff that connects the three roles above. Here's the full journey of one order:

| Stage | Who acts | What happens |
|---|---|---|
| PENDING | Customer | Order placed and paid; restaurant notified |
| ACCEPTED | Restaurant | Restaurant confirms it will make the order |
| PREPARING | Restaurant | Kitchen is cooking |
| READY | Restaurant → System | Restaurant marks ready; platform auto-assigns the **nearest online food driver** |
| PICKED_UP | Driver | Courier collected the food |
| ON_THE_WAY | Driver | Courier heading to the customer — live tracking on the customer's map |
| DELIVERED | Driver | Handed over; driver returns to the pool |

The customer can cancel only **before pickup**; the restaurant can reject only **before accepting the work is underway**. Every stage change reaches the customer instantly as a push notification and a live in-app update.

---

## 5. Admin

**Who:** platform staff who oversee the marketplace. Admin accounts cannot be created through public signup — they're provisioned by the platform (seed script or another admin).

**Getting started:** open the **Admin Console** in a web browser (`http://localhost:5173` in development) and log in with an admin account. Non-admin accounts are refused.

### How to use the console

- **Dashboard** — the platform at a glance: total users, drivers, restaurants, trips and deliveries currently in progress, and gross revenue from completed orders.
- **Users / Drivers / Restaurants** — browse everyone on the platform; edit or remove a restaurant when needed.
- **Trips / Orders** — every ride and food order across all customers, with statuses, parties, and amounts — useful for support ("where is order X?") and dispute resolution.
- **Payments** — every payment record; issue a **refund** (full or partial) directly from here.
- **Ratings** — review the ratings submitted for any driver or restaurant.

The console is deliberately read-mostly: admins observe and intervene (restaurant edits, refunds), while the marketplace itself runs through the mobile app flows above.

---

## Quick demo walkthrough (all roles in 10 minutes)

1. Start the stack (`docker compose up -d`, `npm run start:dev`, `npm run seed` — see the README).
2. **Phone/emulator 1:** log in as `driver@geny.app` → Go online.
3. **Phone/emulator 2:** log in as `customer@geny.app` → request a ride → watch the driver accept and complete it → rate them.
4. Same customer: order two cheeseburgers from **GenY Burger House** → Checkout.
5. **Phone/emulator 3 (or re-login):** `burgers@geny.app` → Accept → Preparing → Ready — watch the driver get auto-assigned.
6. Driver: Picked up → On the way → Delivered.
7. **Browser:** log in to the Admin Console as `admin@geny.app` and see the trip, order, payment, and ratings you just created.
