import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show debugPrint;

import 'package:geny_app/app/core/constants/app_constants.dart';
import 'package:geny_app/app/core/errors/failures.dart';
import 'package:geny_app/app/data/services/secure_storage.dart';

/// A typed API client built on top of `dio`. Every API call returns either
/// a parsed body of the requested type, or throws an `AppFailure` (caught in
/// realm controllers).
class ApiClient {
  ApiClient(this._dio);

  final Dio _dio;

  // ===== Auth =====
  Future<Map<String, dynamic>> login(String identifier, String password) =>
      _unwrap(() => _dio.post('/auth/login', data: {
        'identifier': identifier,
        'password': password,
      }));

  Future<Map<String, dynamic>> register(Map<String, dynamic> body) =>
      _unwrap(() => _dio.post('/auth/register', data: body));

  Future<Map<String, dynamic>> refresh(String refreshToken) =>
      _unwrap(() => _dio.post('/auth/refresh', data: {'refreshToken': refreshToken}));

  Future<Map<String, dynamic>> me() => _unwrap(() => _dio.get('/auth/me'));

  // ===== Users =====
  Future<Map<String, dynamic>> getMyProfile() => _unwrap(() => _dio.get('/users/me'));

  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> body) =>
      _unwrap(() => _dio.patch('/users/me', data: body));

  Future<void> deactivateAccount() => _unwrap(() => _dio.delete('/users/me'));

  // ===== Drivers =====
  Future<List<dynamic>> nearbyDrivers(double lat, double lng, {double radiusKm = 5, int count = 10}) async {
    final r = await _unwrap(() => _dio.get('/drivers/nearby', queryParameters: {
      'lat': lat, 'lng': lng, 'radiusKm': radiusKm, 'count': count,
    }));
    return r['drivers'] as List? ?? [];
  }

  Future<Map<String, dynamic>> driverMe() => _unwrap(() => _dio.get('/drivers/me'));
  Future<Map<String, dynamic>> driverOnline() => _unwrap(() => _dio.post('/drivers/me/online'));
  Future<Map<String, dynamic>> driverOffline() => _unwrap(() => _dio.post('/drivers/me/offline'));
  Future<Map<String, dynamic>> driverPing(double lat, double lng, {double? heading, double? speedKmh}) =>
      _unwrap(() => _dio.post('/drivers/me/ping', data: {
        if (heading != null) 'heading': heading,
        if (speedKmh != null) 'speedKmh': speedKmh,
        'lat': lat, 'lng': lng,
      }));
  Future<Map<String, dynamic>> addVehicle(Map<String, dynamic> body) =>
      _unwrap(() => _dio.post('/drivers/me/vehicles', data: body));
  Future<List<dynamic>> listMyVehicles() async {
    final r = await _unwrap(() => _dio.get('/drivers/me/vehicles'));
    return r['vehicles'] as List? ?? [];
  }

  // ===== Restaurants =====
  Future<List<dynamic>> listRestaurants({String? filter}) async {
    final r = await _unwrap(() => _dio.get('/restaurants', queryParameters: {if (filter != null) 'filter': filter}));
    return r['restaurants'] as List? ?? [];
  }
  Future<Map<String, dynamic>> getRestaurant(String id) async => (await _unwrap(() => _dio.get('/restaurants/$id')))['restaurant'] as Map<String, dynamic>;
  Future<List<dynamic>> listMenuCategories(String restaurantId) async {
    final r = await _unwrap(() => _dio.get('/restaurants/$restaurantId/categories'));
    return r['categories'] as List? ?? [];
  }
  Future<List<dynamic>> listMenuItems(String restaurantId) async {
    final r = await _unwrap(() => _dio.get('/restaurants/$restaurantId/items'));
    return r['items'] as List? ?? [];
  }

  // ===== Trips =====
  Future<Map<String, dynamic>> requestTrip(Map<String, dynamic> body) =>
      _unwrap(() => _dio.post('/trips', data: body));
  Future<Map<String, dynamic>> acceptTrip(String tripId) =>
      _unwrap(() => _dio.post('/trips/$tripId/accept'));
  Future<Map<String, dynamic>> updateTripStatus(String tripId, String status, {String? cancelReason}) =>
      _unwrap(() => _dio.patch('/trips/$tripId/status', data: {
        'status': status,
        if (cancelReason != null) 'cancelReason': cancelReason,
      }));
  Future<List<dynamic>> myTrips() async {
    final r = await _unwrap(() => _dio.get('/trips/me'));
    return r['trips'] as List? ?? [];
  }
  Future<List<dynamic>> driverTrips() async {
    final r = await _unwrap(() => _dio.get('/drivers/me/trips'));
    // The /drivers/me/trips route isn't on backend; we use trips/me on customer side; this is a placeholder.
    return r['trips'] as List? ?? [];
  }
  Future<Map<String, dynamic>> getTrip(String id) async => (await _unwrap(() => _dio.get('/trips/$id')))['trip'] as Map<String, dynamic>;

  // ===== Orders / Food delivery =====
  Future<Map<String, dynamic>> createOrder(Map<String, dynamic> body) =>
      _unwrap(() => _dio.post('/orders', data: body));
  Future<Map<String, dynamic>> updateOrderStatus(String id, String status, {String? cancelReason}) =>
      _unwrap(() => _dio.patch('/orders/$id/status', data: {
        'status': status,
        if (cancelReason != null) 'cancelReason': cancelReason,
      }));
  Future<List<dynamic>> myOrders() async {
    final r = await _unwrap(() => _dio.get('/orders/me'));
    return r['orders'] as List? ?? [];
  }
  Future<Map<String, dynamic>> getOrder(String id) async => (await _unwrap(() => _dio.get('/orders/$id')))['order'] as Map<String, dynamic>;

  // ===== Payments =====
  Future<Map<String, dynamic>> createPaymentIntent({
    required String purpose,
    required String referenceId,
    required double amount,
    String? description,
  }) => _unwrap(() => _dio.post('/payments/intent', data: {
    'purpose': purpose,
    'referenceId': referenceId,
    'amount': amount,
    if (description != null) 'description': description,
  }));

  // ===== Ratings =====
  Future<Map<String, dynamic>> createRating(Map<String, dynamic> body) =>
      _unwrap(() => _dio.post('/ratings', data: body));
  Future<List<dynamic>> listRatings(String target, String targetId) async {
    final r = await _unwrap(() => _dio.get('/ratings', queryParameters: {'target': target, 'targetId': targetId}));
    return r['ratings'] as List? ?? [];
  }

  // ===== Internal =====
  Future<Map<String, dynamic>> _unwrap(Future<Response> Function() request) async {
    try {
      final response = await request();
      final data = response.data;
      if (data is Map<String, dynamic> && data['success'] == true) return data['data'] as Map<String, dynamic>;
      if (data is Map) return Map<String, dynamic>.from(data);
      return {'raw': data};
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
}

/// Auth-interceptor that attaches the JWT to every request, refreshes it on
/// 401 responses, and routes the user to login when refresh fails.
class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._storage);

  final SecureStorage _storage;
  bool _isRefreshing = false;

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
    if (err.response?.statusCode != 401 || _isRefreshing) {
      return handler.next(err);
    }
    if (err.requestOptions.path.contains('/auth/')) {
      return handler.next(err);
    }
    _isRefreshing = true;
    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken == null) throw AppFailure.unauthorized();
      final dio = Dio(BaseOptions(baseUrl: AppConstants.apiBaseUrl));
      final r = await dio.post('/auth/refresh', data: {'refreshToken': refreshToken});
      final body = r.data?['data'] ?? r.data;
      final newAccess = body['accessToken'] as String?;
      if (newAccess == null) throw AppFailure.unauthorized();
      await _storage.writeTokens(accessToken: newAccess, refreshToken: refreshToken);

      // Replay the original request
      final clone = err.requestOptions.copyWith(headers: {'Authorization': 'Bearer $newAccess'});
      final response = await Dio().fetch(clone);
      return handler.resolve(response);
    } catch (_) {
      await _storage.clearAll();
      return handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }
}
