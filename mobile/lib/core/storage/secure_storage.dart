import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/token_store.dart';
import 'session_store.dart';

/// # SecureStorage
///
/// Thin wrapper over [FlutterSecureStorage] exposing the app's known keys
/// only — every value below is sensitive (refresh tokens, device binding)
/// or a state mirror (PIN/biometric flags).
abstract final class SecureStorageKeys {
  static const refreshToken = 'yv_refresh_token';
  static const deviceFingerprint = 'yv_device_fingerprint';
  static const deviceId = 'yv_device_id';
  static const biometricEnabled = 'yv_biometric_enabled';
  static const hasPin = 'yv_has_pin';
  static const userId = 'yv_user_id';
  static const userPhone = 'yv_user_phone';
  static const lastUnlockAt = 'yv_last_unlock_at';
}

class SecureStorage {
  SecureStorage([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  Future<String?> read(String key) => _storage.read(key: key);

  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  Future<void> delete(String key) => _storage.delete(key: key);

  Future<bool> readBool(String key) async =>
      (await _storage.read(key: key)) == 'true';

  Future<void> writeBool(String key, bool value) =>
      _storage.write(key: key, value: value ? 'true' : 'false');

  Future<int?> readInt(String key) async =>
      int.tryParse(await _storage.read(key: key) ?? '');

  Future<void> writeInt(String key, int value) =>
      _storage.write(key: key, value: '$value');

  /// Logout rules: keep fingerprint, device id, biometric flag and the
  /// has-pin mirror (they are per-device/account state); wipe session-owned
  /// values.
  Future<void> clearSession() async {
    await Future.wait(
      [
        SecureStorageKeys.refreshToken,
        SecureStorageKeys.userId,
        SecureStorageKeys.userPhone,
        SecureStorageKeys.lastUnlockAt,
      ].map(delete),
    );
  }

  /// Dev-only: full wipe including the device fingerprint.
  Future<void> clearEverything() async {
    await _storage.deleteAll();
  }
}

final secureStorageProvider = Provider<SecureStorage>((ref) => SecureStorage());

final sessionStoreProvider = Provider<SessionStore>((ref) {
  final storage = ref.watch(secureStorageProvider);
  final tokens = ref.watch(inMemoryTokenStoreProvider);
  final gateway = ref.watch(tokenGatewayProvider);

  final store = SessionStore(storage, tokens);
  store.installTokenGateway(gateway);
  return store;
});
