// Device fingerprint + platform + app version, per Step 21 spec.
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Immutable snapshot of everything /auth/* needs from the device.
class DeviceIdentity {
  const DeviceIdentity({
    required this.fingerprint,
    required this.platform,
    this.model,
    this.osVersion,
    this.appVersion,
    this.pushToken,
  });

  /// 'ANDROID' | 'IOS' — matches backend DeviceInfoSchema.
  final String platform;
  final String fingerprint;
  final String? model;
  final String? osVersion;
  final String? appVersion;
  final String? pushToken;

  /// Header form used by endpoints that take the fingerprint in the header
  /// (pin/set, pin/verify, biometric/enable).
  Map<String, String> headers() => {'x-device-fingerprint': fingerprint};

  /// JSON body form used by verify-otp / unlock. Matches DeviceInfoSchema.
  Map<String, dynamic> toJson() => {
        'fingerprint': fingerprint,
        'platform': platform,
        if (model != null && model!.isNotEmpty) 'model': model,
        if (osVersion != null && osVersion!.isNotEmpty) 'osVersion': osVersion,
        if (appVersion != null && appVersion!.isNotEmpty)
          'appVersion': appVersion,
        if (pushToken != null && pushToken!.isNotEmpty) 'pushToken': pushToken,
      };

  Map<String, dynamic> toBody() => toJson();

  @override
  String toString() => 'DeviceIdentity(platform: $platform)'; // no fingerprint in logs
}

enum DevicePlatform { android, ios }

DevicePlatform _detect() {
  return defaultTargetPlatform == TargetPlatform.iOS
      ? DevicePlatform.ios
      : DevicePlatform.android;
}

/// Collects stable device info for the auth payloads. The caller passes in
/// the persisted fingerprint from SecureStorage so it stays stable forever.
Future<DeviceIdentity> collectDeviceInfo(String fingerprint) async {
  final packageInfo = await PackageInfo.fromPlatform();
  final platform = _detect();

  String? model;
  String? osVersion;

  try {
    final info = await DeviceInfoPlugin().deviceInfo;
    if (info is AndroidDeviceInfo) {
      model = info.model;
      osVersion = 'Android ${info.version.release}';
    } else if (info is IosDeviceInfo) {
      model = info.model;
      osVersion = 'iOS ${info.systemVersion}';
    }
  } catch (_) {
    // Non-fatal: model/osVersion are diagnostics only.
  }

  return DeviceIdentity(
    fingerprint: fingerprint,
    platform: platform == DevicePlatform.ios ? 'IOS' : 'ANDROID',
    model: model,
    osVersion: osVersion,
    appVersion: '${packageInfo.version} (${packageInfo.buildNumber})',
  );
}
