import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_models.freezed.dart';
part 'auth_models.g.dart';

/// Device identity sent with verify-otp / unlock / step-up calls.
/// Contract: backend/src/auth/dto/verify-otp.dto.ts DeviceInfoSchema.
@freezed
class DeviceInfo with _$DeviceInfo {
  const factory DeviceInfo({
    String? id, // server device row id (UUID); response-only
    required String fingerprint,
    required String platform, // 'ANDROID' | 'IOS'
    String? model,
    String? osVersion,
    String? appVersion,
    String? pushToken,
  }) = _DeviceInfo;

  factory DeviceInfo.fromJson(Map<String, dynamic> json) =>
      _$DeviceInfoFromJson(json);
}

@freezed
class AuthTokens with _$AuthTokens {
  const factory AuthTokens({
    required String accessToken,
    required String refreshToken,
    required int expiresIn,
  }) = _AuthTokens;

  factory AuthTokens.fromJson(Map<String, dynamic> json) =>
      _$AuthTokensFromJson(json);
}

/// Authenticated user. Kept as a hand-written model (not freezed) because
/// GET /auth/me returns the raw Prisma record while verify-otp returns the
/// DTO shape — `fromJson` normalizes both.
class User {
  const User({
    required this.id,
    required this.phone,
    required this.fullName,
    required this.role,
    required this.status,
    this.preferredLanguage,
    required this.needsPinSetup,
    required this.needsOnboarding,
  });

  final String id;
  final String phone;
  final String fullName;
  final String role; // 'ADMIN' | 'MERCHANT' | 'SUB_MERCHANT'
  final String status;
  final String? preferredLanguage;
  final bool needsPinSetup;
  final bool needsOnboarding;

  factory User.fromJson(Map<String, dynamic> json) {
    // GET /auth/me currently returns the RAW Prisma user record (verified
    // against the running backend): top-level fields + pinHash/pinSetAt,
    // ownedMerchant, subMerchantProfile — WITHOUT the DTO-computed
    // needsPinSetup / needsOnboarding. Derive them client-side; also accept
    // the documented DTO shape in case the backend adds it later.
    final isRawShape = json['needsPinSetup'] == null && json.containsKey('pinHash');
    if (!isRawShape) {
      return User(
        id: json['id'] as String,
        phone: json['phone'] as String,
        fullName: (json['fullName'] as String?) ?? (json['name'] as String?) ?? '',
        role: (json['role'] as String?) ?? 'MERCHANT',
        status: (json['status'] as String?) ?? 'ACTIVE',
        preferredLanguage: json['preferredLanguage'] as String?,
        needsPinSetup: json['needsPinSetup'] as bool? ?? false,
        needsOnboarding: json['needsOnboarding'] as bool? ?? false,
      );
    }
    final role = (json['role'] as String?) ?? 'MERCHANT';
    final needsOnboarding = switch (role) {
      'MERCHANT' => json['ownedMerchant'] == null,
      'SUB_MERCHANT' => json['subMerchantProfile'] == null,
      _ => false,
    };
    return User(
      id: json['id'] as String,
      phone: json['phone'] as String,
      fullName: (json['fullName'] as String?) ?? (json['name'] as String?) ?? '',
      role: role,
      status: (json['status'] as String?) ?? 'ACTIVE',
      preferredLanguage: json['preferredLanguage'] as String?,
      needsPinSetup: json['pinSetAt'] == null,
      needsOnboarding: needsOnboarding,
    );
  }

  User copyWith({
    String? id,
    String? phone,
    String? fullName,
    String? role,
    String? status,
    String? preferredLanguage,
    bool? needsPinSetup,
    bool? needsOnboarding,
  }) =>
      User(
        id: id ?? this.id,
        phone: phone ?? this.phone,
        fullName: fullName ?? this.fullName,
        role: role ?? this.role,
        status: status ?? this.status,
        preferredLanguage: preferredLanguage ?? this.preferredLanguage,
        needsPinSetup: needsPinSetup ?? this.needsPinSetup,
        needsOnboarding: needsOnboarding ?? this.needsOnboarding,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'phone': phone,
        'fullName': fullName,
        'role': role,
        'status': status,
        if (preferredLanguage != null) 'preferredLanguage': preferredLanguage,
        'needsPinSetup': needsPinSetup,
        'needsOnboarding': needsOnboarding,
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is User &&
          other.id == id &&
          other.phone == phone &&
          other.fullName == fullName &&
          other.role == role &&
          other.status == status &&
          other.preferredLanguage == preferredLanguage &&
          other.needsPinSetup == needsPinSetup &&
          other.needsOnboarding == needsOnboarding;

  @override
  int get hashCode => Object.hash(
        id,
        phone,
        fullName,
        role,
        status,
        preferredLanguage,
        needsPinSetup,
        needsOnboarding,
      );

  @override
  String toString() => 'User(id: $id, phone: $phone, role: $role)';
}

@freezed
class AuthResponse with _$AuthResponse {
  const factory AuthResponse({
    required AuthTokens tokens,
    required User user,
    required DeviceInfo device,
  }) = _AuthResponse;

  factory AuthResponse.fromJson(Map<String, dynamic> json) =>
      _$AuthResponseFromJson(json);
}

/// POST /auth/refresh and POST /auth/unlock return FLAT tokens only
/// ({accessToken, refreshToken, expiresIn}) — no user/device. (Verified
/// against the running backend; see docs/ops Step 21 manual-test log.)
class FlatTokensResponse {
  const FlatTokensResponse({required this.tokens});

  final AuthTokens tokens;

  factory FlatTokensResponse.fromJson(Map<String, dynamic> json) =>
      FlatTokensResponse(tokens: AuthTokens.fromJson(json));
}

/// GET /onboarding/status contract.
@freezed
class OnboardingStatus with _$OnboardingStatus {
  const factory OnboardingStatus({
    @Default(false) bool needsOnboarding,
    @Default('COMPLETE') String step, // 'COMPLETE' | 'MERCHANT_PROFILE' | ...
    Map<String, dynamic>? pendingInvite,
  }) = _OnboardingStatus;

  factory OnboardingStatus.fromJson(Map<String, dynamic> json) =>
      _$OnboardingStatusFromJson(json);
}

/// POST /auth/request-otp contract (dev mock includes otpCode; production
/// returns just the delivery notice).
@freezed
class OtpRequestResponse with _$OtpRequestResponse {
  const factory OtpRequestResponse({
    String? otpId,
    String? otpCode,
    String? expiresAt,
  }) = _OtpRequestResponse;

  factory OtpRequestResponse.fromJson(Map<String, dynamic> json) =>
      _$OtpRequestResponseFromJson(json);
}

/// POST /auth/pin/verify contract.
@freezed
class StepUpResponse with _$StepUpResponse {
  const factory StepUpResponse({
    required String stepUpToken,
    required int expiresIn,
  }) = _StepUpResponse;

  factory StepUpResponse.fromJson(Map<String, dynamic> json) =>
      _$StepUpResponseFromJson(json);
}
