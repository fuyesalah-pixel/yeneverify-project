import 'dart:io';

import 'package:dio/dio.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

/// # ApiError
///
/// Typed error surfaced from every network call. Carries the backend's
/// canonical error code (see shared/contracts/error-codes.json) so screens
/// can map it to a localized message, plus a stable `kind` for control flow.
class ApiError implements Exception {
  const ApiError({
    this.code,
    this.message,
    this.httpStatus,
    this.retryAfterSeconds,
    this.kind = ApiErrorKind.server,
  });

  /// Backend error code, e.g. `AUTH_INVALID_OTP`. Null when the failure
  /// never reached the backend (network, timeout, malformed envelope).
  final String? code;

  /// Raw backend message (English). Screens prefer localized mappings.
  final String? message;

  final int? httpStatus;

  /// Seconds to wait before retrying a rate-limited call, when provided.
  final int? retryAfterSeconds;

  final ApiErrorKind kind;

  static const ApiError network = ApiError(kind: ApiErrorKind.network);
  static const ApiError timeout = ApiError(kind: ApiErrorKind.timeout);
  static const ApiError serverError = ApiError(kind: ApiErrorKind.server);
  static const ApiError unauthorized = ApiError(
    kind: ApiErrorKind.auth,
    code: 'UNAUTHORIZED',
  );

  bool get isNetwork => kind == ApiErrorKind.network;
  bool get isTimeout => kind == ApiErrorKind.timeout;
  bool get isAuth => kind == ApiErrorKind.auth;

  @override
  String toString() =>
      'ApiError(kind: $kind, code: $code, status: $httpStatus, '
      'retryAfter: $retryAfterSeconds, message: $message)';
}

enum ApiErrorKind { network, timeout, auth, validation, server }

/// # Error-code mapping
///
/// Maps canonical backend codes to AppErrorCategory. Screens use the
/// category + context to pick a localized message; strings themselves stay
/// in the ARBs so this file never hardcodes English UI copy.
abstract final class ApiErrorCodes {
  /// Codes that mean "the code the user entered is wrong".
  static const wrongOtp = <String>{
    'AUTH_INVALID_OTP',
    'AUTH_OTP_INVALID',
  };

  /// Codes that mean "the code the user entered has expired".
  static const expiredOtp = <String>{'AUTH_OTP_EXPIRED'};

  /// Codes that mean "the PIN the user entered is wrong".
  static const wrongPin = <String>{'AUTH_PIN_INVALID'};

  /// Codes that mean "too many attempts, wait before retrying".
  static const attemptsExhausted = <String>{
    'AUTH_OTP_MAX_ATTEMPTS',
    'AUTH_OTP_RATE_LIMITED',
    'AUTH_PIN_MAX_ATTEMPTS',
    'AUTH_PIN_LOCKED',
    'AUTH_RATE_LIMITED',
    'RATE_LIMITED',
  };

  /// Codes that mean "phone itself is not valid".
  static const phoneInvalid = <String>{'AUTH_PHONE_INVALID'};

  /// Codes that mean "this refresh token / session is no good".
  static const sessionInvalid = <String>{
    'AUTH_REFRESH_INVALID',
    'AUTH_REFRESH_EXPIRED',
    'AUTH_REFRESH_REUSE_DETECTED',
    'AUTH_SESSION_EXPIRED',
    'AUTH_TOKEN_INVALID',
    'AUTH_TOKEN_EXPIRED',
    'AUTH_DEVICE_MISMATCH',
    'AUTH_DEVICE_NOT_FOUND',
    'AUTH_DEVICE_REVOKED',
    'UNAUTHORIZED',
  };

  /// Codes that mean the account itself cannot log in right now.
  static const accountBlocked = <String>{
    'AUTH_ACCOUNT_BANNED',
    'AUTH_ACCOUNT_SUSPENDED',
    'AUTH_ACCOUNT_DELETED',
    'MERCHANT_SUSPENDED',
  };

  static const deviceLimit = {'AUTH_DEVICE_LIMIT'};
  static const pinNotSet = {'AUTH_PIN_NOT_SET'};
  static const biometricNotEnabled = {
    'AUTH_BIOMETRIC_NOT_ENABLED',
    'AUTH_BIOMETRIC_FAILED',
  };
  static const validationFailed = {'VALIDATION_FAILED'};
}

/// Maps any [DioException] into the typed [ApiError]. Used by the repository
/// layer so no screen ever inspects raw Dio exceptions.
ApiError apiErrorFromDio(Object error) {
  if (error is ApiError) return error;

  if (error is DioException) {
    final response = error.response;
    final dynamic body = response?.data;

    // Backend error envelope: { success:false, error:{ code, message, ... } }
    if (body is Map && body['error'] is Map) {
      final err = body['error'] as Map;
      return ApiError(
        code: err['code'] as String?,
        message: err['message'] is String ? err['message'] as String : null,
        httpStatus: response?.statusCode,
        retryAfterSeconds: _retryAfter(response),
        kind: _kindFromStatus(response?.statusCode),
      );
    }

    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return error.type == DioExceptionType.connectionTimeout
          ? ApiError.timeout
          : ApiError.network;
    }
    if (error.type == DioExceptionType.receiveTimeout) {
      return ApiError.timeout;
    }

    // Socket exceptions escape Dio's wrapper on some platforms.
    if (error.error is SocketException) return ApiError.network;

    return const ApiError(
      code: 'NETWORK_ERROR',
      kind: ApiErrorKind.network,
    );
  }

  return const ApiError(kind: ApiErrorKind.server);
}

ApiErrorKind _kindFromStatus(int? status) {
  if (status == null) return ApiErrorKind.server;
  if (status == 401) return ApiErrorKind.auth;
  if (status >= 400 && status < 500) return ApiErrorKind.validation;
  return ApiErrorKind.server;
}

int? _retryAfter(Response<Object?>? response) {
  final header = response?.headers.value('retry-after');
  if (header != null) {
    final parsed = int.tryParse(header);
    if (parsed != null) return parsed;
  }
  final body = response?.data;
  if (body is Map && body['error'] is Map) {
    final details = (body['error'] as Map)['details'];
    if (details is Map && details['retryAfter'] is num) {
      return (details['retryAfter'] as num).toInt();
    }
  }
  return null;
}

extension ApiErrorKindX on ApiErrorKind {
  bool get network =>
      this == ApiErrorKind.network || this == ApiErrorKind.timeout;
}

/// Shows a user-facing message for an [ApiError], mapped from the backend's
/// canonical error code. English literals are fallbacks for contexts without
/// a [BuildContext]; screens should pass [AppLocalizations].
extension ApiErrorX on ApiError {
  String userFacingMessage([AppLocalizations? l10n]) {
    final code = this.code;

    if (code != null && ApiErrorCodes.attemptsExhausted.contains(code)) {
      if (retryAfterSeconds != null &&
          retryAfterSeconds! > 0 &&
          retryAfterSeconds! < 3600) {
        final minutes = (retryAfterSeconds! / 60).ceil();
        return l10n?.pinLocked(minutes) ??
            'Too many attempts. Try again in $minutes minutes.';
      }
      return l10n?.otpMaxAttempts ??
          'Too many attempts. Please wait before trying again.';
    }
    if (code != null && ApiErrorCodes.expiredOtp.contains(code)) {
      return l10n?.otpExpired ?? 'Code expired. Resend a new one.';
    }
    if (code != null && ApiErrorCodes.wrongOtp.contains(code)) {
      return l10n?.otpInvalid ?? 'Incorrect code. Try again.';
    }
    if (code != null && ApiErrorCodes.wrongPin.contains(code)) {
      return l10n?.pinIncorrect ?? 'Incorrect PIN. Try again.';
    }
    if (code != null && ApiErrorCodes.phoneInvalid.contains(code)) {
      return l10n?.phoneInvalid ?? 'Enter a valid Ethiopian phone number';
    }
    if (code != null && ApiErrorCodes.deviceLimit.contains(code)) {
      return l10n?.errorDeviceLimit ??
          'Too many devices. Remove one from settings.';
    }
    if (code != null && ApiErrorCodes.accountBlocked.contains(code)) {
      return l10n?.errorAccountBanned ??
          'This account has been suspended. Contact support.';
    }
    if (code != null && ApiErrorCodes.sessionInvalid.contains(code)) {
      return l10n?.sessionExpired ?? 'Your session has expired. Please log in again.';
    }
    if (code != null && ApiErrorCodes.biometricNotEnabled.contains(code)) {
      return l10n?.biometricFailed ??
          'Biometric authentication failed. Use your PIN.';
    }
    if (kind == ApiErrorKind.network || kind == ApiErrorKind.timeout) {
      return l10n?.networkError ?? 'Check your connection and try again.';
    }
    return l10n?.genericError ?? 'Something went wrong. Please try again.';
  }
}
