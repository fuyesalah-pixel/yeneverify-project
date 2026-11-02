// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DeviceInfo _$DeviceInfoFromJson(Map<String, dynamic> json) {
  return _DeviceInfo.fromJson(json);
}

/// @nodoc
mixin _$DeviceInfo {
  String? get id =>
      throw _privateConstructorUsedError; // server device row id (UUID); response-only
  String get fingerprint => throw _privateConstructorUsedError;
  String get platform =>
      throw _privateConstructorUsedError; // 'ANDROID' | 'IOS'
  String? get model => throw _privateConstructorUsedError;
  String? get osVersion => throw _privateConstructorUsedError;
  String? get appVersion => throw _privateConstructorUsedError;
  String? get pushToken => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $DeviceInfoCopyWith<DeviceInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DeviceInfoCopyWith<$Res> {
  factory $DeviceInfoCopyWith(
          DeviceInfo value, $Res Function(DeviceInfo) then) =
      _$DeviceInfoCopyWithImpl<$Res, DeviceInfo>;
  @useResult
  $Res call(
      {String? id,
      String fingerprint,
      String platform,
      String? model,
      String? osVersion,
      String? appVersion,
      String? pushToken});
}

/// @nodoc
class _$DeviceInfoCopyWithImpl<$Res, $Val extends DeviceInfo>
    implements $DeviceInfoCopyWith<$Res> {
  _$DeviceInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = freezed,
    Object? fingerprint = null,
    Object? platform = null,
    Object? model = freezed,
    Object? osVersion = freezed,
    Object? appVersion = freezed,
    Object? pushToken = freezed,
  }) {
    return _then(_value.copyWith(
      id: freezed == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String?,
      fingerprint: null == fingerprint
          ? _value.fingerprint
          : fingerprint // ignore: cast_nullable_to_non_nullable
              as String,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      model: freezed == model
          ? _value.model
          : model // ignore: cast_nullable_to_non_nullable
              as String?,
      osVersion: freezed == osVersion
          ? _value.osVersion
          : osVersion // ignore: cast_nullable_to_non_nullable
              as String?,
      appVersion: freezed == appVersion
          ? _value.appVersion
          : appVersion // ignore: cast_nullable_to_non_nullable
              as String?,
      pushToken: freezed == pushToken
          ? _value.pushToken
          : pushToken // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DeviceInfoImplCopyWith<$Res>
    implements $DeviceInfoCopyWith<$Res> {
  factory _$$DeviceInfoImplCopyWith(
          _$DeviceInfoImpl value, $Res Function(_$DeviceInfoImpl) then) =
      __$$DeviceInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String? id,
      String fingerprint,
      String platform,
      String? model,
      String? osVersion,
      String? appVersion,
      String? pushToken});
}

/// @nodoc
class __$$DeviceInfoImplCopyWithImpl<$Res>
    extends _$DeviceInfoCopyWithImpl<$Res, _$DeviceInfoImpl>
    implements _$$DeviceInfoImplCopyWith<$Res> {
  __$$DeviceInfoImplCopyWithImpl(
      _$DeviceInfoImpl _value, $Res Function(_$DeviceInfoImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = freezed,
    Object? fingerprint = null,
    Object? platform = null,
    Object? model = freezed,
    Object? osVersion = freezed,
    Object? appVersion = freezed,
    Object? pushToken = freezed,
  }) {
    return _then(_$DeviceInfoImpl(
      id: freezed == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String?,
      fingerprint: null == fingerprint
          ? _value.fingerprint
          : fingerprint // ignore: cast_nullable_to_non_nullable
              as String,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      model: freezed == model
          ? _value.model
          : model // ignore: cast_nullable_to_non_nullable
              as String?,
      osVersion: freezed == osVersion
          ? _value.osVersion
          : osVersion // ignore: cast_nullable_to_non_nullable
              as String?,
      appVersion: freezed == appVersion
          ? _value.appVersion
          : appVersion // ignore: cast_nullable_to_non_nullable
              as String?,
      pushToken: freezed == pushToken
          ? _value.pushToken
          : pushToken // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DeviceInfoImpl implements _DeviceInfo {
  const _$DeviceInfoImpl(
      {this.id,
      required this.fingerprint,
      required this.platform,
      this.model,
      this.osVersion,
      this.appVersion,
      this.pushToken});

  factory _$DeviceInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$DeviceInfoImplFromJson(json);

  @override
  final String? id;
// server device row id (UUID); response-only
  @override
  final String fingerprint;
  @override
  final String platform;
// 'ANDROID' | 'IOS'
  @override
  final String? model;
  @override
  final String? osVersion;
  @override
  final String? appVersion;
  @override
  final String? pushToken;

  @override
  String toString() {
    return 'DeviceInfo(id: $id, fingerprint: $fingerprint, platform: $platform, model: $model, osVersion: $osVersion, appVersion: $appVersion, pushToken: $pushToken)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DeviceInfoImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.fingerprint, fingerprint) ||
                other.fingerprint == fingerprint) &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.model, model) || other.model == model) &&
            (identical(other.osVersion, osVersion) ||
                other.osVersion == osVersion) &&
            (identical(other.appVersion, appVersion) ||
                other.appVersion == appVersion) &&
            (identical(other.pushToken, pushToken) ||
                other.pushToken == pushToken));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(runtimeType, id, fingerprint, platform, model,
      osVersion, appVersion, pushToken);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$DeviceInfoImplCopyWith<_$DeviceInfoImpl> get copyWith =>
      __$$DeviceInfoImplCopyWithImpl<_$DeviceInfoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DeviceInfoImplToJson(
      this,
    );
  }
}

abstract class _DeviceInfo implements DeviceInfo {
  const factory _DeviceInfo(
      {final String? id,
      required final String fingerprint,
      required final String platform,
      final String? model,
      final String? osVersion,
      final String? appVersion,
      final String? pushToken}) = _$DeviceInfoImpl;

  factory _DeviceInfo.fromJson(Map<String, dynamic> json) =
      _$DeviceInfoImpl.fromJson;

  @override
  String? get id;
  @override // server device row id (UUID); response-only
  String get fingerprint;
  @override
  String get platform;
  @override // 'ANDROID' | 'IOS'
  String? get model;
  @override
  String? get osVersion;
  @override
  String? get appVersion;
  @override
  String? get pushToken;
  @override
  @JsonKey(ignore: true)
  _$$DeviceInfoImplCopyWith<_$DeviceInfoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AuthTokens _$AuthTokensFromJson(Map<String, dynamic> json) {
  return _AuthTokens.fromJson(json);
}

/// @nodoc
mixin _$AuthTokens {
  String get accessToken => throw _privateConstructorUsedError;
  String get refreshToken => throw _privateConstructorUsedError;
  int get expiresIn => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $AuthTokensCopyWith<AuthTokens> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthTokensCopyWith<$Res> {
  factory $AuthTokensCopyWith(
          AuthTokens value, $Res Function(AuthTokens) then) =
      _$AuthTokensCopyWithImpl<$Res, AuthTokens>;
  @useResult
  $Res call({String accessToken, String refreshToken, int expiresIn});
}

/// @nodoc
class _$AuthTokensCopyWithImpl<$Res, $Val extends AuthTokens>
    implements $AuthTokensCopyWith<$Res> {
  _$AuthTokensCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? accessToken = null,
    Object? refreshToken = null,
    Object? expiresIn = null,
  }) {
    return _then(_value.copyWith(
      accessToken: null == accessToken
          ? _value.accessToken
          : accessToken // ignore: cast_nullable_to_non_nullable
              as String,
      refreshToken: null == refreshToken
          ? _value.refreshToken
          : refreshToken // ignore: cast_nullable_to_non_nullable
              as String,
      expiresIn: null == expiresIn
          ? _value.expiresIn
          : expiresIn // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AuthTokensImplCopyWith<$Res>
    implements $AuthTokensCopyWith<$Res> {
  factory _$$AuthTokensImplCopyWith(
          _$AuthTokensImpl value, $Res Function(_$AuthTokensImpl) then) =
      __$$AuthTokensImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String accessToken, String refreshToken, int expiresIn});
}

/// @nodoc
class __$$AuthTokensImplCopyWithImpl<$Res>
    extends _$AuthTokensCopyWithImpl<$Res, _$AuthTokensImpl>
    implements _$$AuthTokensImplCopyWith<$Res> {
  __$$AuthTokensImplCopyWithImpl(
      _$AuthTokensImpl _value, $Res Function(_$AuthTokensImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? accessToken = null,
    Object? refreshToken = null,
    Object? expiresIn = null,
  }) {
    return _then(_$AuthTokensImpl(
      accessToken: null == accessToken
          ? _value.accessToken
          : accessToken // ignore: cast_nullable_to_non_nullable
              as String,
      refreshToken: null == refreshToken
          ? _value.refreshToken
          : refreshToken // ignore: cast_nullable_to_non_nullable
              as String,
      expiresIn: null == expiresIn
          ? _value.expiresIn
          : expiresIn // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthTokensImpl implements _AuthTokens {
  const _$AuthTokensImpl(
      {required this.accessToken,
      required this.refreshToken,
      required this.expiresIn});

  factory _$AuthTokensImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthTokensImplFromJson(json);

  @override
  final String accessToken;
  @override
  final String refreshToken;
  @override
  final int expiresIn;

  @override
  String toString() {
    return 'AuthTokens(accessToken: $accessToken, refreshToken: $refreshToken, expiresIn: $expiresIn)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthTokensImpl &&
            (identical(other.accessToken, accessToken) ||
                other.accessToken == accessToken) &&
            (identical(other.refreshToken, refreshToken) ||
                other.refreshToken == refreshToken) &&
            (identical(other.expiresIn, expiresIn) ||
                other.expiresIn == expiresIn));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode =>
      Object.hash(runtimeType, accessToken, refreshToken, expiresIn);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthTokensImplCopyWith<_$AuthTokensImpl> get copyWith =>
      __$$AuthTokensImplCopyWithImpl<_$AuthTokensImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthTokensImplToJson(
      this,
    );
  }
}

abstract class _AuthTokens implements AuthTokens {
  const factory _AuthTokens(
      {required final String accessToken,
      required final String refreshToken,
      required final int expiresIn}) = _$AuthTokensImpl;

  factory _AuthTokens.fromJson(Map<String, dynamic> json) =
      _$AuthTokensImpl.fromJson;

  @override
  String get accessToken;
  @override
  String get refreshToken;
  @override
  int get expiresIn;
  @override
  @JsonKey(ignore: true)
  _$$AuthTokensImplCopyWith<_$AuthTokensImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AuthResponse _$AuthResponseFromJson(Map<String, dynamic> json) {
  return _AuthResponse.fromJson(json);
}

/// @nodoc
mixin _$AuthResponse {
  AuthTokens get tokens => throw _privateConstructorUsedError;
  User get user => throw _privateConstructorUsedError;
  DeviceInfo get device => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $AuthResponseCopyWith<AuthResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthResponseCopyWith<$Res> {
  factory $AuthResponseCopyWith(
          AuthResponse value, $Res Function(AuthResponse) then) =
      _$AuthResponseCopyWithImpl<$Res, AuthResponse>;
  @useResult
  $Res call({AuthTokens tokens, User user, DeviceInfo device});

  $AuthTokensCopyWith<$Res> get tokens;
  $DeviceInfoCopyWith<$Res> get device;
}

/// @nodoc
class _$AuthResponseCopyWithImpl<$Res, $Val extends AuthResponse>
    implements $AuthResponseCopyWith<$Res> {
  _$AuthResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tokens = null,
    Object? user = null,
    Object? device = null,
  }) {
    return _then(_value.copyWith(
      tokens: null == tokens
          ? _value.tokens
          : tokens // ignore: cast_nullable_to_non_nullable
              as AuthTokens,
      user: null == user
          ? _value.user
          : user // ignore: cast_nullable_to_non_nullable
              as User,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as DeviceInfo,
    ) as $Val);
  }

  @override
  @pragma('vm:prefer-inline')
  $AuthTokensCopyWith<$Res> get tokens {
    return $AuthTokensCopyWith<$Res>(_value.tokens, (value) {
      return _then(_value.copyWith(tokens: value) as $Val);
    });
  }

  @override
  @pragma('vm:prefer-inline')
  $DeviceInfoCopyWith<$Res> get device {
    return $DeviceInfoCopyWith<$Res>(_value.device, (value) {
      return _then(_value.copyWith(device: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AuthResponseImplCopyWith<$Res>
    implements $AuthResponseCopyWith<$Res> {
  factory _$$AuthResponseImplCopyWith(
          _$AuthResponseImpl value, $Res Function(_$AuthResponseImpl) then) =
      __$$AuthResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({AuthTokens tokens, User user, DeviceInfo device});

  @override
  $AuthTokensCopyWith<$Res> get tokens;
  @override
  $DeviceInfoCopyWith<$Res> get device;
}

/// @nodoc
class __$$AuthResponseImplCopyWithImpl<$Res>
    extends _$AuthResponseCopyWithImpl<$Res, _$AuthResponseImpl>
    implements _$$AuthResponseImplCopyWith<$Res> {
  __$$AuthResponseImplCopyWithImpl(
      _$AuthResponseImpl _value, $Res Function(_$AuthResponseImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tokens = null,
    Object? user = null,
    Object? device = null,
  }) {
    return _then(_$AuthResponseImpl(
      tokens: null == tokens
          ? _value.tokens
          : tokens // ignore: cast_nullable_to_non_nullable
              as AuthTokens,
      user: null == user
          ? _value.user
          : user // ignore: cast_nullable_to_non_nullable
              as User,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as DeviceInfo,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthResponseImpl implements _AuthResponse {
  const _$AuthResponseImpl(
      {required this.tokens, required this.user, required this.device});

  factory _$AuthResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthResponseImplFromJson(json);

  @override
  final AuthTokens tokens;
  @override
  final User user;
  @override
  final DeviceInfo device;

  @override
  String toString() {
    return 'AuthResponse(tokens: $tokens, user: $user, device: $device)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthResponseImpl &&
            (identical(other.tokens, tokens) || other.tokens == tokens) &&
            (identical(other.user, user) || other.user == user) &&
            (identical(other.device, device) || other.device == device));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(runtimeType, tokens, user, device);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthResponseImplCopyWith<_$AuthResponseImpl> get copyWith =>
      __$$AuthResponseImplCopyWithImpl<_$AuthResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthResponseImplToJson(
      this,
    );
  }
}

abstract class _AuthResponse implements AuthResponse {
  const factory _AuthResponse(
      {required final AuthTokens tokens,
      required final User user,
      required final DeviceInfo device}) = _$AuthResponseImpl;

  factory _AuthResponse.fromJson(Map<String, dynamic> json) =
      _$AuthResponseImpl.fromJson;

  @override
  AuthTokens get tokens;
  @override
  User get user;
  @override
  DeviceInfo get device;
  @override
  @JsonKey(ignore: true)
  _$$AuthResponseImplCopyWith<_$AuthResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OnboardingStatus _$OnboardingStatusFromJson(Map<String, dynamic> json) {
  return _OnboardingStatus.fromJson(json);
}

/// @nodoc
mixin _$OnboardingStatus {
  bool get needsOnboarding => throw _privateConstructorUsedError;
  String get step =>
      throw _privateConstructorUsedError; // 'COMPLETE' | 'MERCHANT_PROFILE' | ...
  Map<String, dynamic>? get pendingInvite => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $OnboardingStatusCopyWith<OnboardingStatus> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OnboardingStatusCopyWith<$Res> {
  factory $OnboardingStatusCopyWith(
          OnboardingStatus value, $Res Function(OnboardingStatus) then) =
      _$OnboardingStatusCopyWithImpl<$Res, OnboardingStatus>;
  @useResult
  $Res call(
      {bool needsOnboarding, String step, Map<String, dynamic>? pendingInvite});
}

/// @nodoc
class _$OnboardingStatusCopyWithImpl<$Res, $Val extends OnboardingStatus>
    implements $OnboardingStatusCopyWith<$Res> {
  _$OnboardingStatusCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? needsOnboarding = null,
    Object? step = null,
    Object? pendingInvite = freezed,
  }) {
    return _then(_value.copyWith(
      needsOnboarding: null == needsOnboarding
          ? _value.needsOnboarding
          : needsOnboarding // ignore: cast_nullable_to_non_nullable
              as bool,
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as String,
      pendingInvite: freezed == pendingInvite
          ? _value.pendingInvite
          : pendingInvite // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OnboardingStatusImplCopyWith<$Res>
    implements $OnboardingStatusCopyWith<$Res> {
  factory _$$OnboardingStatusImplCopyWith(_$OnboardingStatusImpl value,
          $Res Function(_$OnboardingStatusImpl) then) =
      __$$OnboardingStatusImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {bool needsOnboarding, String step, Map<String, dynamic>? pendingInvite});
}

/// @nodoc
class __$$OnboardingStatusImplCopyWithImpl<$Res>
    extends _$OnboardingStatusCopyWithImpl<$Res, _$OnboardingStatusImpl>
    implements _$$OnboardingStatusImplCopyWith<$Res> {
  __$$OnboardingStatusImplCopyWithImpl(_$OnboardingStatusImpl _value,
      $Res Function(_$OnboardingStatusImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? needsOnboarding = null,
    Object? step = null,
    Object? pendingInvite = freezed,
  }) {
    return _then(_$OnboardingStatusImpl(
      needsOnboarding: null == needsOnboarding
          ? _value.needsOnboarding
          : needsOnboarding // ignore: cast_nullable_to_non_nullable
              as bool,
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as String,
      pendingInvite: freezed == pendingInvite
          ? _value._pendingInvite
          : pendingInvite // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OnboardingStatusImpl implements _OnboardingStatus {
  const _$OnboardingStatusImpl(
      {this.needsOnboarding = false,
      this.step = 'COMPLETE',
      final Map<String, dynamic>? pendingInvite})
      : _pendingInvite = pendingInvite;

  factory _$OnboardingStatusImpl.fromJson(Map<String, dynamic> json) =>
      _$$OnboardingStatusImplFromJson(json);

  @override
  @JsonKey()
  final bool needsOnboarding;
  @override
  @JsonKey()
  final String step;
// 'COMPLETE' | 'MERCHANT_PROFILE' | ...
  final Map<String, dynamic>? _pendingInvite;
// 'COMPLETE' | 'MERCHANT_PROFILE' | ...
  @override
  Map<String, dynamic>? get pendingInvite {
    final value = _pendingInvite;
    if (value == null) return null;
    if (_pendingInvite is EqualUnmodifiableMapView) return _pendingInvite;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  String toString() {
    return 'OnboardingStatus(needsOnboarding: $needsOnboarding, step: $step, pendingInvite: $pendingInvite)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OnboardingStatusImpl &&
            (identical(other.needsOnboarding, needsOnboarding) ||
                other.needsOnboarding == needsOnboarding) &&
            (identical(other.step, step) || other.step == step) &&
            const DeepCollectionEquality()
                .equals(other._pendingInvite, _pendingInvite));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(runtimeType, needsOnboarding, step,
      const DeepCollectionEquality().hash(_pendingInvite));

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$OnboardingStatusImplCopyWith<_$OnboardingStatusImpl> get copyWith =>
      __$$OnboardingStatusImplCopyWithImpl<_$OnboardingStatusImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OnboardingStatusImplToJson(
      this,
    );
  }
}

abstract class _OnboardingStatus implements OnboardingStatus {
  const factory _OnboardingStatus(
      {final bool needsOnboarding,
      final String step,
      final Map<String, dynamic>? pendingInvite}) = _$OnboardingStatusImpl;

  factory _OnboardingStatus.fromJson(Map<String, dynamic> json) =
      _$OnboardingStatusImpl.fromJson;

  @override
  bool get needsOnboarding;
  @override
  String get step;
  @override // 'COMPLETE' | 'MERCHANT_PROFILE' | ...
  Map<String, dynamic>? get pendingInvite;
  @override
  @JsonKey(ignore: true)
  _$$OnboardingStatusImplCopyWith<_$OnboardingStatusImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OtpRequestResponse _$OtpRequestResponseFromJson(Map<String, dynamic> json) {
  return _OtpRequestResponse.fromJson(json);
}

/// @nodoc
mixin _$OtpRequestResponse {
  String? get otpId => throw _privateConstructorUsedError;
  String? get otpCode => throw _privateConstructorUsedError;
  String? get expiresAt => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $OtpRequestResponseCopyWith<OtpRequestResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OtpRequestResponseCopyWith<$Res> {
  factory $OtpRequestResponseCopyWith(
          OtpRequestResponse value, $Res Function(OtpRequestResponse) then) =
      _$OtpRequestResponseCopyWithImpl<$Res, OtpRequestResponse>;
  @useResult
  $Res call({String? otpId, String? otpCode, String? expiresAt});
}

/// @nodoc
class _$OtpRequestResponseCopyWithImpl<$Res, $Val extends OtpRequestResponse>
    implements $OtpRequestResponseCopyWith<$Res> {
  _$OtpRequestResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? otpId = freezed,
    Object? otpCode = freezed,
    Object? expiresAt = freezed,
  }) {
    return _then(_value.copyWith(
      otpId: freezed == otpId
          ? _value.otpId
          : otpId // ignore: cast_nullable_to_non_nullable
              as String?,
      otpCode: freezed == otpCode
          ? _value.otpCode
          : otpCode // ignore: cast_nullable_to_non_nullable
              as String?,
      expiresAt: freezed == expiresAt
          ? _value.expiresAt
          : expiresAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OtpRequestResponseImplCopyWith<$Res>
    implements $OtpRequestResponseCopyWith<$Res> {
  factory _$$OtpRequestResponseImplCopyWith(_$OtpRequestResponseImpl value,
          $Res Function(_$OtpRequestResponseImpl) then) =
      __$$OtpRequestResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String? otpId, String? otpCode, String? expiresAt});
}

/// @nodoc
class __$$OtpRequestResponseImplCopyWithImpl<$Res>
    extends _$OtpRequestResponseCopyWithImpl<$Res, _$OtpRequestResponseImpl>
    implements _$$OtpRequestResponseImplCopyWith<$Res> {
  __$$OtpRequestResponseImplCopyWithImpl(_$OtpRequestResponseImpl _value,
      $Res Function(_$OtpRequestResponseImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? otpId = freezed,
    Object? otpCode = freezed,
    Object? expiresAt = freezed,
  }) {
    return _then(_$OtpRequestResponseImpl(
      otpId: freezed == otpId
          ? _value.otpId
          : otpId // ignore: cast_nullable_to_non_nullable
              as String?,
      otpCode: freezed == otpCode
          ? _value.otpCode
          : otpCode // ignore: cast_nullable_to_non_nullable
              as String?,
      expiresAt: freezed == expiresAt
          ? _value.expiresAt
          : expiresAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OtpRequestResponseImpl implements _OtpRequestResponse {
  const _$OtpRequestResponseImpl({this.otpId, this.otpCode, this.expiresAt});

  factory _$OtpRequestResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$OtpRequestResponseImplFromJson(json);

  @override
  final String? otpId;
  @override
  final String? otpCode;
  @override
  final String? expiresAt;

  @override
  String toString() {
    return 'OtpRequestResponse(otpId: $otpId, otpCode: $otpCode, expiresAt: $expiresAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OtpRequestResponseImpl &&
            (identical(other.otpId, otpId) || other.otpId == otpId) &&
            (identical(other.otpCode, otpCode) || other.otpCode == otpCode) &&
            (identical(other.expiresAt, expiresAt) ||
                other.expiresAt == expiresAt));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(runtimeType, otpId, otpCode, expiresAt);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$OtpRequestResponseImplCopyWith<_$OtpRequestResponseImpl> get copyWith =>
      __$$OtpRequestResponseImplCopyWithImpl<_$OtpRequestResponseImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OtpRequestResponseImplToJson(
      this,
    );
  }
}

abstract class _OtpRequestResponse implements OtpRequestResponse {
  const factory _OtpRequestResponse(
      {final String? otpId,
      final String? otpCode,
      final String? expiresAt}) = _$OtpRequestResponseImpl;

  factory _OtpRequestResponse.fromJson(Map<String, dynamic> json) =
      _$OtpRequestResponseImpl.fromJson;

  @override
  String? get otpId;
  @override
  String? get otpCode;
  @override
  String? get expiresAt;
  @override
  @JsonKey(ignore: true)
  _$$OtpRequestResponseImplCopyWith<_$OtpRequestResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

StepUpResponse _$StepUpResponseFromJson(Map<String, dynamic> json) {
  return _StepUpResponse.fromJson(json);
}

/// @nodoc
mixin _$StepUpResponse {
  String get stepUpToken => throw _privateConstructorUsedError;
  int get expiresIn => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $StepUpResponseCopyWith<StepUpResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $StepUpResponseCopyWith<$Res> {
  factory $StepUpResponseCopyWith(
          StepUpResponse value, $Res Function(StepUpResponse) then) =
      _$StepUpResponseCopyWithImpl<$Res, StepUpResponse>;
  @useResult
  $Res call({String stepUpToken, int expiresIn});
}

/// @nodoc
class _$StepUpResponseCopyWithImpl<$Res, $Val extends StepUpResponse>
    implements $StepUpResponseCopyWith<$Res> {
  _$StepUpResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? stepUpToken = null,
    Object? expiresIn = null,
  }) {
    return _then(_value.copyWith(
      stepUpToken: null == stepUpToken
          ? _value.stepUpToken
          : stepUpToken // ignore: cast_nullable_to_non_nullable
              as String,
      expiresIn: null == expiresIn
          ? _value.expiresIn
          : expiresIn // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$StepUpResponseImplCopyWith<$Res>
    implements $StepUpResponseCopyWith<$Res> {
  factory _$$StepUpResponseImplCopyWith(_$StepUpResponseImpl value,
          $Res Function(_$StepUpResponseImpl) then) =
      __$$StepUpResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String stepUpToken, int expiresIn});
}

/// @nodoc
class __$$StepUpResponseImplCopyWithImpl<$Res>
    extends _$StepUpResponseCopyWithImpl<$Res, _$StepUpResponseImpl>
    implements _$$StepUpResponseImplCopyWith<$Res> {
  __$$StepUpResponseImplCopyWithImpl(
      _$StepUpResponseImpl _value, $Res Function(_$StepUpResponseImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? stepUpToken = null,
    Object? expiresIn = null,
  }) {
    return _then(_$StepUpResponseImpl(
      stepUpToken: null == stepUpToken
          ? _value.stepUpToken
          : stepUpToken // ignore: cast_nullable_to_non_nullable
              as String,
      expiresIn: null == expiresIn
          ? _value.expiresIn
          : expiresIn // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$StepUpResponseImpl implements _StepUpResponse {
  const _$StepUpResponseImpl(
      {required this.stepUpToken, required this.expiresIn});

  factory _$StepUpResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$StepUpResponseImplFromJson(json);

  @override
  final String stepUpToken;
  @override
  final int expiresIn;

  @override
  String toString() {
    return 'StepUpResponse(stepUpToken: $stepUpToken, expiresIn: $expiresIn)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$StepUpResponseImpl &&
            (identical(other.stepUpToken, stepUpToken) ||
                other.stepUpToken == stepUpToken) &&
            (identical(other.expiresIn, expiresIn) ||
                other.expiresIn == expiresIn));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(runtimeType, stepUpToken, expiresIn);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$StepUpResponseImplCopyWith<_$StepUpResponseImpl> get copyWith =>
      __$$StepUpResponseImplCopyWithImpl<_$StepUpResponseImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$StepUpResponseImplToJson(
      this,
    );
  }
}

abstract class _StepUpResponse implements StepUpResponse {
  const factory _StepUpResponse(
      {required final String stepUpToken,
      required final int expiresIn}) = _$StepUpResponseImpl;

  factory _StepUpResponse.fromJson(Map<String, dynamic> json) =
      _$StepUpResponseImpl.fromJson;

  @override
  String get stepUpToken;
  @override
  int get expiresIn;
  @override
  @JsonKey(ignore: true)
  _$$StepUpResponseImplCopyWith<_$StepUpResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
