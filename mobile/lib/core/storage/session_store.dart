import '../network/token_store.dart';
import 'secure_storage.dart';

/// # SessionStore
///
/// Rules enforced here (spec "Secure storage"):
/// - Access token NEVER on disk (stays in [InMemoryTokenStore]).
/// - Refresh token ONLY in secure storage.
/// - Device fingerprint is generated on first launch, then stable forever.
/// - Logout clears refresh_token + user_id + user_phone + last_unlock_at;
///   keeps device_fingerprint, device_id and biometric_enabled.
class SessionStore {
  SessionStore(this._storage, this._tokens);

  final SecureStorage _storage;
  final InMemoryTokenStore _tokens;

  void installTokenGateway(TokenGateway gateway) {
    gateway.readRefreshToken = () => _refreshTokenSync;
    gateway.writeRefreshToken = setRefreshToken;
    gateway.clear = logout;
  }

  String? _refreshTokenSync;

  // ── Refresh token ──────────────────────────────────────────────────────

  Future<String?> readRefreshToken() async {
    _refreshTokenSync ??=
        await _storage.read(SecureStorageKeys.refreshToken);
    return _refreshTokenSync;
  }

  Future<void> setRefreshToken(String token) async {
    _refreshTokenSync = token;
    await _storage.write(SecureStorageKeys.refreshToken, token);
  }

  // ── Access token (in-memory only) ──────────────────────────────────────

  String? get accessToken => _tokens.accessToken;

  void setAccessToken(String token) => _tokens.set(token);

  void clearAccessToken() => _tokens.clear();

  // ── Device fingerprint / server device row ─────────────────────────────

  Future<String?> readFingerprint() =>
      _storage.read(SecureStorageKeys.deviceFingerprint);

  Future<void> setFingerprint(String fingerprint) =>
      _storage.write(SecureStorageKeys.deviceFingerprint, fingerprint);

  Future<String?> readDeviceId() =>
      _storage.read(SecureStorageKeys.deviceId);

  Future<void> setDeviceId(String id) =>
      _storage.write(SecureStorageKeys.deviceId, id);

  // ── State mirrors ──────────────────────────────────────────────────────

  Future<String?> readUserId() => _storage.read(SecureStorageKeys.userId);

  Future<void> setUserId(String id) =>
      _storage.write(SecureStorageKeys.userId, id);

  Future<String?> readUserPhone() =>
      _storage.read(SecureStorageKeys.userPhone);

  Future<void> setUserPhone(String phone) =>
      _storage.write(SecureStorageKeys.userPhone, phone);

  Future<bool> readBiometricEnabled() =>
      _storage.readBool(SecureStorageKeys.biometricEnabled);

  Future<void> setBiometricEnabled(bool value) =>
      _storage.writeBool(SecureStorageKeys.biometricEnabled, value);

  Future<bool> readHasPin() => _storage.readBool(SecureStorageKeys.hasPin);

  Future<void> setHasPin(bool value) =>
      _storage.writeBool(SecureStorageKeys.hasPin, value);

  Future<void> touchUnlock() => _storage.writeInt(
        SecureStorageKeys.lastUnlockAt,
        DateTime.now().millisecondsSinceEpoch,
      );

  Future<int?> readLastUnlockAt() =>
      _storage.readInt(SecureStorageKeys.lastUnlockAt);

  // ── Destructive ops ────────────────────────────────────────────────────

  /// Clears session values but keeps per-device values (logout).
  Future<void> logout() async {
    _refreshTokenSync = null;
    _tokens.clear();
    await _storage.clearSession();
  }

  /// Dev-only: wipes everything including the device fingerprint.
  Future<void> wipe() async {
    _refreshTokenSync = null;
    _tokens.clear();
    await _storage.clearEverything();
  }
}
