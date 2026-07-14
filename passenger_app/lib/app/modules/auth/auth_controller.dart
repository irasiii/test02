import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:geny_app/app/core/errors/failures.dart';
import 'package:geny_app/app/data/models/app_role.dart';
import 'package:geny_app/app/data/providers/providers.dart';
import 'package:geny_app/app/data/services/api_client.dart';
import 'package:geny_app/app/data/services/secure_storage.dart';

// `fromString` is defined on the extension AppRoleX. The Dart language requires
// extension statics to be invoked with the extension name, not the type name.
AppRole _roleFromString(String s) => AppRoleX.fromString(s);

/// Immutable snapshot of the currently authenticated session.
@immutable
class AuthState {
  const AuthState({
    this.isLoading = false,
    this.error,
    this.userId,
    this.email,
    this.fullName,
    this.role,
    this.accessToken,
  });

  final bool isLoading;
  final AppFailure? error;
  final String? userId;
  final String? email;
  final String? fullName;
  final AppRole? role;
  final String? accessToken;

  bool get isAuthenticated => accessToken != null && userId != null;
  bool get isDriver => role == AppRole.DRIVER;

  /// The home route for the current role (used by redirects/splash).
  String get homePath {
    switch (role) {
      case AppRole.DRIVER:
        return '/driver';
      case AppRole.RESTAURANT:
        return '/restaurant';
      case AppRole.ADMIN:
        return '/admin';
      case AppRole.CUSTOMER:
      case null:
        return '/passenger';
    }
  }

  AuthState copyWith({
    bool? isLoading,
    AppFailure? error,
    String? userId,
    String? email,
    String? fullName,
    AppRole? role,
    String? accessToken,
    bool clearError = false,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      userId: userId ?? this.userId,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
      accessToken: accessToken ?? this.accessToken,
    );
  }
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._api, this._storage)
      : super(const AuthState()) {
    _bootstrap();
  }

  final ApiClient _api;
  final SecureStorage _storage;

  /// Rehydrate from secure storage on app startup.
  Future<void> _bootstrap() async {
    final token = await _storage.getAccessToken();
    final roleStr = await _storage.getRole();
    final userId = await _storage.getUserId();
    final email = await _storage.getUserEmail();
    final fullName = await _storage.getUserName();
    if (token != null && roleStr != null) {
      state = state.copyWith(
        accessToken: token,
        userId: userId,
        email: email,
        fullName: fullName,
        role: _roleFromString(roleStr),
      );
    }
  }

  Future<bool> login(String identifier, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final body = await _api.login(identifier, password);
      await _persist(body);
      await _pushFcmToken();
      state = state.copyWith(isLoading: false);
      return true;
    } on AppFailure catch (f) {
      state = state.copyWith(isLoading: false, error: f, clearError: true);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: AppFailure.serverError(e.toString()), clearError: true);
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String phone,
    required String firstName,
    required String lastName,
    required String password,
    required AppRole role,
    String? fcmToken,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final body = await _api.register({
        'email': email,
        'phone': phone,
        'firstName': firstName,
        'lastName': lastName,
        'password': password,
        'role': role.asString,
        if (fcmToken != null) 'fcmToken': fcmToken,
      });
      await _persist(body);
      state = state.copyWith(isLoading: false);
      return true;
    } on AppFailure catch (f) {
      state = state.copyWith(isLoading: false, error: f, clearError: true);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: AppFailure.serverError(e.toString()), clearError: true);
      return false;
    }
  }

  Future<void> logout() async {
    await _storage.clearAll();
    state = const AuthState();
  }

  /// Push the locally cached FCM token to the server once authenticated.
  Future<void> _pushFcmToken() async {
    final token = await _storage.getFcmToken();
    if (token == null) return;
    try {
      await _api.updateProfile({'fcmToken': token});
    } catch (_) {
      // Retried by FcmRegistrar on token refresh / next launch.
    }
  }

  Future<void> _persist(Map<String, dynamic> body) async {
    final accessToken = body['accessToken'] as String?;
    final refreshToken = body['refreshToken'] as String?;
    final user = body['user'] as Map<String, dynamic>? ?? {};
    final roleStr = user['role'] as String?;
    if (accessToken == null || refreshToken == null || roleStr == null) {
      throw AppFailure.serverError('Invalid auth response');
    }
    await _storage.writeTokens(accessToken: accessToken, refreshToken: refreshToken);
    await _storage.writeUserProfile(
      userId: user['id'] as String,
      email: user['email'] as String,
      role: roleStr,
      fullName: '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim(),
    );
    state = state.copyWith(
      accessToken: accessToken,
      userId: user['id'] as String?,
      email: user['email'] as String?,
      fullName: '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim(),
      role: _roleFromString(roleStr),
    );
  }
}

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(ref.watch(apiClientProvider), ref.watch(secureStorageProvider));
});
