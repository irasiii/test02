import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show debugPrint;

import 'package:geny_app/app/core/constants/app_constants.dart';
import 'package:geny_app/app/core/errors/failures.dart';
import 'package:geny_app/app/data/services/secure_storage.dart';

/// A typed API client built on top of `dio`. Every API call returns either
/// a parsed body (Map/List) of the requested type, or throws an `AppFailure`
/// (caught in realm controllers).
///
/// The backend wraps every successful response as `{ success: true, data: <body> }`
/// where `<body>` is the raw entity, array, or scalar returned by the controller.
class ApiClient {
  ApiClient(this._dio);

  final Dio _dio;

  // ===== Auth =====
  Future<Map<String, dynamic>> login(String identifier, String password) =>
      _unwrapMap(() => _dio.post('/auth/login', data: {
        'identifier': identifier,
        'password': password,
      }));

  Future<Map<String, dynamic>> register(Map<String, dynamic> body) =>
      _unwrapMap(() => _dio.post('/auth/register', data: body));

  Future<Map<String, dynamic>> refresh(String refreshToken) =>
      _unwrapMap(() => _dio.post('/auth/refresh', data: {'refreshToken': refreshToken}));

  Future<Map<String, dynamic>> me() => _unwrapMap(() => _dio.get('/auth/me'));

  // ===== Users =====
  Future<Map<String, dynamic>> getMyProfile() => _unwrapMap(() => _dio.get('/users/me'));

  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> body) =>
      _unwrapMap(() => _dio.patch('/users/me', data: body));

  Future<void> deactivateAccount() => _unwrapMap(() => _dio.delete('/users/me'));

  // ===== Drivers =====
  Future<List<dynamic>> nearbyDrivers(double lat, double lng, {double radiusKm = 5, int count = 10}) async {
    final r = await _unwrap(() => _dio.get('/drivers/nearby', queryParameters: {
      'lat': lat, 'lng': lng, 'radiusKm': radiusKm, 'count': count,
    }));
    return _asList(r);
  }

  Future<Map<String, dynamic>> driverMe() => _unwrapMap(() => _dio.get('/drivers/me'));
  Future<Map<String, dynamic>> driverOnline() => _unwrapMap(() => _dio.post('/drivers/me/online'));
  Future<Map<String, dynamic>> driverOffline() => _unwrapMap(() => _dio.post('/drivers/me/offline'));
  Future<Map<String, dynamic>> driverPing(double lat, double lng, {double? heading, double? speedKmh}) =>
      _unwrapMap(() => _dio.post('/drivers/me/ping', data: {
        if (heading != null) 'heading': heading,
        if (speedKmh != null) 'speedKmh': speedKmh,
        'lat': lat, 'lng': lng,
      }));
  Future<Map<String, dynamic>> addVehicle(Map<String, dynamic> body) =>
      _unwrapMap(() => _dio.post('/drivers/me/vehicles', data: body));
  Future<List<dynamic>> listMyVehicles() async {
    final r = await _unwrap(() => _dio.get('/drivers/me/vehicles'));
    return _asList(r);
  }

  // ===== Restaurants =====
  Future<List<dynamic>> listRestaurants({String? filter}) async {
    final r = await _unwrap(() => _dio.get('/restaurants', queryParameters: {if (filter != null) 'filter': filter}));
    return _asList(r);
  }
  Future<Map<String, dynamic>> getRestaurant(String id) async => _asMap(await _unwrap(() => _dio.get('/restaurants/$id')));
  Future<List<dynamic>> listMenuCategories(String restaurantId) async {
    final r = await _unwrap(() => _dio.get('/restaurants/$restaurantId/categories'));
    return _asList(r);
  }
  Future<List<dynamic>> listMenuItems(String restaurantId) async {
    final r = await _unwrap(() => _dio.get('/restaurants/$restaurantId/items'));
    return _asList(r);
  }

  // ===== Trips =====
  Future<Map<String, dynamic>> requestTrip(Map<String, dynamic> body) =>
      _unwrapMap(() => _dio.post('/trips', data: body));
  Future<Map<String, dynamic>> acceptTrip(String tripId) =>
      _unwrapMap(() => _dio.post('/trips/$tripId/accept'));
  Future<Map<String, dynamic>> updateTripStatus(String tripId, String status, {String? cancelReason}) =>
      _unwrapMap(() => _dio.patch('/trips/$tripId/status', data: {
        'status': status,
        if (cancelReason != null) 'cancelReason': cancelReason,
      }));
  Future<List<dynamic>> myTrips() async {
    final r = await _unwrap(() => _dio.get('/trips/me'));
    return _asList(r);
  }
  Future<Map<String, dynamic>> getTrip(String id) async => _asMap(await _unwrap(() => _dio.get('/trips/$id')));

  // ===== Orders / Food delivery =====
  Future<Map<String, dynamic>> createOrder(Map<String, dynamic> body) =>
      _unwrapMap(() => _dio.post('/orders', data: body));
  Future<Map<String, dynamic>> updateOrderStatus(String id, String status, {String? cancelReason}) =>
      _unwrapMap(() => _dio.patch('/orders/$id/status', data: {
        'status': status,
        if (cancelReason != null) 'cancelReason': cancelReason,
      }));
  Future<List<dynamic>> myOrders() async {
    final r = await _unwrap(() => _dio.get('/orders/me'));
    return _asList(r);
  }
  Future<List<dynamic>> driverDeliveries() async {
    final r = await _unwrap(() => _dio.get('/orders/driver'));
    return _asList(r);
  }
  Future<Map<String, dynamic>> getOrder(String id) async => _asMap(await _unwrap(() => _dio.get('/orders/$id')));

  // ===== Payments =====
  Future<Map<String, dynamic>> createPaymentIntent({
    required String purpose,
    required String referenceId,
    required double amount,
    String? description,
  }) => _unwrapMap(() => _dio.post('/payments/intent', data: {
    'purpose': purpose,
    'referenceId': referenceId,
    'amount': amount,
    if (description != null) 'description': description,
  }));

  // ===== Ratings =====
  Future<Map<String, dynamic>> createRating(Map<String, dynamic> body) =>
      _unwrapMap(() => _dio.post('/ratings', data: body));
  Future<List<dynamic>> listRatings(String target, String targetId) async {
    final r = await _unwrap(() => _dio.get('/ratings', queryParameters: {'target': target, 'targetId': targetId}));
    return _asList(r);
  }

  // ===== Internal =====
  ///
  /// Unwraps a response and coerces it to a [Map<String, dynamic>].
  Future<Map<String, dynamic>> _unwrapMap(Future<Response> Function() request) async =>
      (await _unwrap(request)) as Map<String, dynamic>;

  /// Returns the unwrapped `data` payload (Map, List, or scalar) from the
  /// backend envelope `{ success: true, data: <body> }`.
  Future<dynamic> _unwrap(Future<Response> Function() request) async {
    try {
      final response = await request();
      final data = response.data;
      if (data is Map && data['success'] == true) return data['data'];
      if (data is Map && data.containsKey('data')) return data['data'];
      return data;
    } on DioException catch (e, s) {
      debugPrint('[ApiClient] DioException: ${e.message}\n$s');
      if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.unknown) {
        throw AppFailure.network();
      }
      final statusCode = e.response?.statusCode ?? 0;
      if (statusCode == 401) throw AppFailure.unauthorized();
      throw AppFailure.fromResponse(statusCode, e.response?.data);
    } catch (e) {
      debugPrint('[ApiClient] Unexpected: $e');
      throw AppFailure.serverError(e.toString());
    }
  }

  /// Best-effort coercion of a response payload into a list.
  ///
  /// Handles both raw arrays and the (legacy) `{ <key>: [...] }` envelope.
  static List<dynamic> _asList(dynamic value) {
    if (value is List) return value;
    if (value is Map) {
      for (final key in const ['orders', 'trips', 'drivers', 'restaurants', 'categories', 'items', 'vehicles', 'ratings']) {
        final v = value[key];
        if (v is List) return v;
      }
      final d = value['data'];
      if (d is List) return d;
    }
    return [];
  }

  /// Best-effort coercion of a response payload into a map.
  static Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return {};
  }
}

/// Auth-interceptor that attaches the JWT to every request, refreshes it on
/// 401 responses, and routes the user to login when refresh fails.
///
/// Concurrent 401s during a single refresh are queued and replayed once the
/// new access token is available, so no request is lost.
class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._storage);

  final SecureStorage _storage;
  bool _isRefreshing = false;
  final List<_QueuedRequest> _queue = [];

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _storage.getAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    // Only attempt refresh for genuine 401s outside the auth endpoints.
    if (err.response?.statusCode != 401) return handler.next(err);
    if (err.requestOptions.path.contains('/auth/')) return handler.next(err);

    // If a refresh is already in flight, queue this request and let the
    // in-flight refresh replay it once the new token is ready.
    if (_isRefreshing) {
      final completer = Completer<Response<dynamic>>();
      _queue.add(_QueuedRequest(err.requestOptions, completer));
      try {
        return handler.resolve(await completer.future);
      } catch (e) {
        return handler.next(err);
      }
    }

    _isRefreshing = true;
    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken == null) throw AppFailure.unauthorized();

      final dio = Dio(BaseOptions(baseUrl: AppConstants.apiBaseUrl));
      final r = await dio.post('/auth/refresh', data: {'refreshToken': refreshToken});
      final body = r.data is Map ? (r.data['data'] ?? r.data) : r.data;
      final newAccess = body is Map ? body['accessToken'] as String? : null;
      if (newAccess == null) throw AppFailure.unauthorized();
      await _storage.writeTokens(accessToken: newAccess, refreshToken: refreshToken);

      // Replay the original request with the fresh token, preserving headers.
      final opts = err.requestOptions;
      opts.headers['Authorization'] = 'Bearer $newAccess';
      final replayed = await Dio().fetch(opts);

      // Replay any requests that queued up during the refresh.
      for (final q in _queue) {
        try {
          final qOpts = q.options;
          qOpts.headers['Authorization'] = 'Bearer $newAccess';
          q.completer.complete(await Dio().fetch(qOpts));
        } catch (e) {
          q.completer.completeError(e);
        }
      }
      _queue.clear();

      return handler.resolve(replayed);
    } catch (_) {
      await _storage.clearAll();
      for (final q in _queue) {
        q.completer.completeError(err);
      }
      _queue.clear();
      return handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }
}

class _QueuedRequest {
  _QueuedRequest(this.options, this.completer);
  final RequestOptions options;
  final Completer<Response<dynamic>> completer;
}
