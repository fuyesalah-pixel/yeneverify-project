// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DeviceInfoImpl _$$DeviceInfoImplFromJson(Map<String, dynamic> json) =>
    _$DeviceInfoImpl(
      id: json['id'] as String?,
      fingerprint: json['fingerprint'] as String,
      platform: json['platform'] as String,
      model: json['model'] as String?,
      osVersion: json['osVersion'] as String?,
      appVersion: json['appVersion'] as String?,
      pushToken: json['pushToken'] as String?,
    );

Map<String, dynamic> _$$DeviceInfoImplToJson(_$DeviceInfoImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'fingerprint': instance.fingerprint,
      'platform': instance.platform,
      'model': instance.model,
      'osVersion': instance.osVersion,
      'appVersion': instance.appVersion,
      'pushToken': instance.pushToken,
    };

_$AuthTokensImpl _$$AuthTokensImplFromJson(Map<String, dynamic> json) =>
    _$AuthTokensImpl(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      expiresIn: (json['expiresIn'] as num).toInt(),
    );

Map<String, dynamic> _$$AuthTokensImplToJson(_$AuthTokensImpl instance) =>
    <String, dynamic>{
      'accessToken': instance.accessToken,
      'refreshToken': instance.refreshToken,
      'expiresIn': instance.expiresIn,
    };

_$AuthResponseImpl _$$AuthResponseImplFromJson(Map<String, dynamic> json) =>
    _$AuthResponseImpl(
      tokens: AuthTokens.fromJson(json['tokens'] as Map<String, dynamic>),
      user: User.fromJson(json['user'] as Map<String, dynamic>),
      device: DeviceInfo.fromJson(json['device'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthResponseImplToJson(_$AuthResponseImpl instance) =>
    <String, dynamic>{
      'tokens': instance.tokens,
      'user': instance.user,
      'device': instance.device,
    };

_$OnboardingStatusImpl _$$OnboardingStatusImplFromJson(
        Map<String, dynamic> json) =>
    _$OnboardingStatusImpl(
      needsOnboarding: json['needsOnboarding'] as bool? ?? false,
      step: json['step'] as String? ?? 'COMPLETE',
      pendingInvite: json['pendingInvite'] as Map<String, dynamic>?,
    );

Map<String, dynamic> _$$OnboardingStatusImplToJson(
        _$OnboardingStatusImpl instance) =>
    <String, dynamic>{
      'needsOnboarding': instance.needsOnboarding,
      'step': instance.step,
      'pendingInvite': instance.pendingInvite,
    };

_$OtpRequestResponseImpl _$$OtpRequestResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$OtpRequestResponseImpl(
      otpId: json['otpId'] as String?,
      otpCode: json['otpCode'] as String?,
      expiresAt: json['expiresAt'] as String?,
    );

Map<String, dynamic> _$$OtpRequestResponseImplToJson(
        _$OtpRequestResponseImpl instance) =>
    <String, dynamic>{
      'otpId': instance.otpId,
      'otpCode': instance.otpCode,
      'expiresAt': instance.expiresAt,
    };

_$StepUpResponseImpl _$$StepUpResponseImplFromJson(Map<String, dynamic> json) =>
    _$StepUpResponseImpl(
      stepUpToken: json['stepUpToken'] as String,
      expiresIn: (json['expiresIn'] as num).toInt(),
    );

Map<String, dynamic> _$$StepUpResponseImplToJson(
        _$StepUpResponseImpl instance) =>
    <String, dynamic>{
      'stepUpToken': instance.stepUpToken,
      'expiresIn': instance.expiresIn,
    };
