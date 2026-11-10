import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_models.freezed.dart';
part 'auth_models.g.dart';

/// Device identity sent with Google auth / unlock / step-up calls.
/// Contract: backend DeviceInfoSchema (auth DTOs).
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
/// GET /auth/me returns the raw Prisma record while Google auth returns the
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
    // GET /auth/me returns the RAW Prisma user record (verified against the
    // running backend): top-level fields + pinHash/pinSetAt, ownedMerchant,
    // subMerchantProfile — WITHOUT the DTO-computed needsPinSetup /
    // needsOnboarding. Onboarding routing comes ONLY from /onboarding/status
    // (see AuthNotifier); /auth/me is identity + real PIN state.
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
    return User(
      id: json['id'] as String,
      phone: json['phone'] as String,
      fullName: (json['fullName'] as String?) ?? (json['name'] as String?) ?? '',
      role: (json['role'] as String?) ?? 'MERCHANT',
      status: (json['status'] as String?) ?? 'ACTIVE',
      preferredLanguage: json['preferredLanguage'] as String?,
      needsPinSetup: json['pinSetAt'] == null,
      // Deliberately not derived from ownedMerchant: the guard on /auth/me
      // used to make this the only source pre-onboarding, which is why it
      // diverged from /onboarding/status.
      needsOnboarding: json['needsOnboarding'] as bool? ?? false,
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

/// Pending sub-merchant invite carried by GET /onboarding/status.
/// Contract: backend OnboardingStatusService (`pendingInvite`).
class PendingInvite {
  const PendingInvite({
    required this.id,
    required this.merchantName,
    this.branchLabel,
  });

  final String id;
  final String merchantName;
  final String? branchLabel;

  factory PendingInvite.fromJson(Map<String, dynamic> json) => PendingInvite(
        id: json['id'] as String,
        merchantName: (json['merchantName'] as String?) ?? '',
        branchLabel: json['branchLabel'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'merchantName': merchantName,
        if (branchLabel != null) 'branchLabel': branchLabel,
      };
}

/// GET /onboarding/status contract — the single source of truth for
/// onboarding routing. `/auth/me` is identity only.
@freezed
class OnboardingStatus with _$OnboardingStatus {
  const factory OnboardingStatus({
    @Default(false) bool needsOnboarding,
    @Default('COMPLETE') String step, // 'COMPLETE' | 'MERCHANT_PROFILE' | ...
    PendingInvite? pendingInvite,
  }) = _OnboardingStatus;

  factory OnboardingStatus.fromJson(Map<String, dynamic> json) =>
      _$OnboardingStatusFromJson(json);
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
