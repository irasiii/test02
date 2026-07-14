import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persisted ("secure") storage for auth tokens, role, and FCM token.
///
/// On Android uses EncryptedSharedPreferences; on iOS uses Keychain.
class SecureStorage {
  SecureStorage._();
  static final SecureStorage instance = SecureStorage._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _kAccessToken = 'geny.access_token';
  static const _kRefreshToken = 'geny.refresh_token';
  static const _kRole = 'geny.role';
  static const _kUserId = 'geny.user_id';
  static const _kUserEmail = 'geny.user_email';
  static const _kUserName = 'geny.user_name';
  static const _kFcmToken = 'geny.fcm_token';

  // ---------- Tokens ----------
  Future<String?> getAccessToken() async => await _storage.read(key: _kAccessToken);
  Future<String?> getRefreshToken() async => await _storage.read(key: _kRefreshToken);

  Future<void> writeTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _kAccessToken, value: accessToken);
    await _storage.write(key: _kRefreshToken, value: refreshToken);
  }

  // ---------- User Profile ----------
  Future<String?> getRole() async => await _storage.read(key: _kRole);
  Future<String?> getUserId() async => await _storage.read(key: _kUserId);
  Future<String?> getUserEmail() async => await _storage.read(key: _kUserEmail);
  Future<String?> getUserName() async => await _storage.read(key: _kUserName);

  Future<void> writeUserProfile({
    required String userId,
    required String email,
    required String role,
    String? fullName,
  }) async {
    await _storage.write(key: _kUserId, value: userId);
    await _storage.write(key: _kUserEmail, value: email);
    await _storage.write(key: _kRole, value: role);
    if (fullName != null) await _storage.write(key: _kUserName, value: fullName);
  }

  // ---------- FCM ----------
  Future<String?> getFcmToken() async => await _storage.read(key: _kFcmToken);
  Future<void> writeFcmToken(String token) async => _storage.write(key: _kFcmToken, value: token);

  // ---------- Clear ----------
  Future<void> clearAll() async {
    await _storage.deleteAll();
    debugPrint('[SecureStorage] cleared credentials');
  }
}
