class AppConstants {
  AppConstants._();

  // ===== Backend =====
  /// 10.0.2.2 maps to host machine from Android emulator. iOS simulators use localhost.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1',
  );

  /// Websocket namespace for tracking (see backend src/modules/tracking/tracking.gateway.ts).
  static const String wsBaseUrl = String.fromEnvironment(
    'WS_BASE_URL',
    defaultValue: 'ws://10.0.2.2:3000/tracking',
  );

  static const String googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: '',
  );

  // ===== Brand =====
  static const String appName = 'GenY';
  static const String supportEmail = 'support@geny.app';
  static const String supportPhone = '+10000000000';

  // ===== Defaults =====
  static const int driverSearchRadiusKm = 5;
  static const int nearbyDriverCountLimit = 10;
  static const double defaultMapZoom = 15.5;
  static const Duration driverLocationPingInterval = Duration(seconds: 10);

  // ===== Stripe =====
  static const String stripePublishableKey = String.fromEnvironment(
    'STRIPE_PUBLISHABLE_KEY',
    defaultValue: '',
  );
}
