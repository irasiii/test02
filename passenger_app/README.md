# GenY — Flutter Super-App (Passenger + Driver)

A single Flutter codebase that ships **two role-based apps**:
- **Passenger app** — book rides + order food (Uber + Uber Eats in one)
- **Driver app** — accept ride + delivery offers, broadcast live location

Built with **Flutter 3.13+**, Riverpod, go_router, Dio, Google Maps, Firebase Messaging, WebSockets.

## Architecture

```
lib/
├── main.dart                         — app entry + Firebase init
└── app/
    ├── core/
    │   ├── constants/app_constants   — API base URL, WS, Google Maps key
    │   ├── errors/failures           — AppFailure sealed Result<T>
    │   ├── theme/app_theme           — light + dark Material 3 themes
    │   ├── router/app_router         — go_router with auth + role guards
    │   └── utils/geo_utils           — Haversine distance
    ├── data/
    │   ├── models/app_role           — Role enum (matches backend)
    │   ├── providers/providers       — Riverpod providers for Dio + ApiClient
    │   └── services/
    │       ├── api_client            — Dio wrapper + JWT auth interceptor + refresh
    │       ├── secure_storage        — EncryptedSharedPreferences / Keychain
    │       └── tracking_client       — WebSocket client for live tracking
    └── modules/
        ├── auth/                     — login + register + splash + AuthController
        ├── common/widgets            — shared widgets (PrimaryButton)
        ├── passenger/
        │   ├── home/                 — Google Maps + nearby drivers + ride request sheet
        │   └── food/                 — restaurants list + menu sheet + checkout
        ├── driver/
        │   └── home/                 — online/offline toggle + trip offer card + active trip
        └── shared/
            ├── profile/              — profile + logout
            └── history/              — trips / orders / deliveries history
```

## Setup

```bash
cd passenger_app
flutter pub get
```

### Configure backend URL
Edit `lib/app/core/constants/app_constants.dart` or pass via `--dart-define`:
```bash
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1 \
  --dart-define=WS_BASE_URL=ws://10.0.2.2:3000/tracking \
  --dart-define=GOOGLE_MAPS_API_KEY=your_key
```

> `10.0.2.2` is the Android emulator's address for the host machine. iOS simulators use `localhost`.

### Configure Google Maps
- **Android**: add your API key to `android/app/src/main/AndroidManifest.xml` inside `<application>`:
  ```xml
  <meta-data android:name="com.google.android.geo.API_KEY"
             android:value="YOUR_KEY"/>
  ```
- **iOS**: add to `ios/Runner/AppDelegate.swift`:
  ```swift
  GMSServices.provideAPIKey("YOUR_KEY")
  ```

### Configure Firebase (optional — push notifications)
```bash
flutterfire configure
```
This generates `firebase_options.dart`. If skipped, the app still runs — push notifications are silently disabled.

## Run

```bash
flutter run
```

## Demo accounts

From the backend seed (`npm run seed` in the parent backend):

| Role     | Email             | Password   |
|----------|-------------------|------------|
| Customer | customer@geny.app | P@ssw0rd   |
| Driver   | driver@geny.app   | P@ssw0rd   |

All other test accounts (`admin@`, `burgers@`) aren't relevant to the mobile app.

## Features

### Passenger role
- Live Google Map with nearby driver markers
- Set pickup + destination → request ride with fare estimate
- Browse restaurants → view menu → add to cart → checkout with Stripe
- Ride history, order history
- Profile + logout

### Driver role
- Online/offline toggle (broadcasts location to Redis geo index via backend)
- Auto-ping location every 10s
- Accept/decline incoming trip offers (via WebSocket `driver:offer`)
- Active trip card with live map, status flow buttons (Arriving → Arrived → Started → Completed)
- Delivery history

### Real-time
- WebSocket to `/tracking` namespace (socket.io)
- Subscribes to `trip:<id>`, `order:<id>`, `driver:<userId>` rooms
- Auto-reconnect on disconnect
- Heartbeat ping every 30s

## State management

- **Riverpod 2** with `StateNotifier` for auth and driver home
- `FutureProvider.family` for history lists
- `Provider` for singletons (Dio, ApiClient, TrackingClient, SecureStorage)

## Connection to backend

The app expects the GenY backend (parent directory) running at `API_BASE_URL` with all flow endpoints described in `../README.md`. Swagger docs: `http://localhost:3000/docs`.

## Test

```bash
flutter test
flutter analyze
```

Both pass clean as of last commit.
