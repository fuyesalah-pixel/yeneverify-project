import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'secure_storage.dart';
import 'session_store.dart';

/// # DeviceFingerprint
///
/// Stable per-install identifier generated once on first launch:
/// sha256(platform|android-id|model|device|app-id|app-version|random-salt).
/// Persisted in secure storage and never regenerated — the backend keys the
/// device row on it, and changing it would orphan the saved sessions.
///
/// We do NOT hash phone numbers, SIM state, or anything that changes with
/// system updates; AndroidId (per-app on 8+, stable enough for binding) plus
/// a random salt generated alongside it covers the spec.
class DeviceFingerprint {
  DeviceFingerprint(this._store);

  final SessionStore _store;

  static const _platform = 'ANDROID';

  Future<String> getOrCreate() async {
    final existing = await _store.readFingerprint();
    if (existing != null && existing.isNotEmpty) return existing;

    final parts = <String>[];
    try {
      final info = await DeviceInfoPlugin().androidInfo;
      parts.add(info.id);
      parts.add(info.model);
      parts.add(info.device);
    } catch (_) {
      // Test environments may lack the plugin; fall back to random only.
      parts.add('unknown-hardware');
    }

    String appId = 'yene_verify';
    String appVersion = '';
    try {
      final pkg = await PackageInfo.fromPlatform();
      appId = pkg.packageName;
      appVersion = '${pkg.version}+${pkg.buildNumber}';
    } catch (_) {
      // Non-fatal: the salt still makes the identifier unique.
    }

    parts.add(_platform);
    parts.add(appId);
    parts.add(appVersion);
    parts.add(_randomSalt());

    final digest = sha256.convert(utf8.encode(parts.join('|')));
    final fingerprint = 'yv_${digest.toString().substring(0, 32)}';

    await _store.setFingerprint(fingerprint);
    return fingerprint;
  }

  String _randomSalt() {
    final rng = Random.secure();
    return List.generate(16, (_) => rng.nextInt(16).toRadixString(16)).join();
  }

  /// Display name for device management lists (Step 27).
  static String describeDevice(Map<String, dynamic> deviceInfo) =>
      deviceInfo['model'] as String? ?? _platform;
}

final deviceFingerprintProvider = Provider<DeviceFingerprint>((ref) {
  final store = ref.watch(sessionStoreProvider);
  return DeviceFingerprint(store);
});
