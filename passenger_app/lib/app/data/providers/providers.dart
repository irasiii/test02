import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:geny_app/app/core/constants/app_constants.dart';
import 'package:geny_app/app/data/services/api_client.dart';
import 'package:geny_app/app/data/services/secure_storage.dart';

/// Singleton secure-storage provider.
final secureStorageProvider = Provider<SecureStorage>((ref) => SecureStorage.instance);

/// Dio instance configured with the API base URL and Auth interceptor.
final dioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(secureStorageProvider);
  final dio = Dio(BaseOptions(
    baseUrl: AppConstants.apiBaseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
    sendTimeout: const Duration(seconds: 15),
    headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
  ));
  dio.interceptors.add(AuthInterceptor(storage));
  if (!const bool.fromEnvironment('dart.vm.product')) {
    dio.interceptors.add(LogInterceptor(requestBody: true, responseBody: true, error: true, requestHeader: false));
  }
  return dio;
});

/// ApiClient provider (wraps dio).
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(dioProvider));
});
