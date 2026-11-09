import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/env/app_env.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/l10n/app_localizations_en.dart';

DioException _connectFailure(Object socketError) => DioException(
      requestOptions: RequestOptions(path: '/auth/google/signin'),
      type: DioExceptionType.connectionError,
      error: socketError,
    );

SocketException _socket(String message, int code) =>
    SocketException(message, osError: OSError(message, code));

void main() {
  final l10n = AppLocalizationsEn();
  final host = Uri.parse(AppEnv.apiBaseUrl).host;

  group('apiErrorFromDio names the socket failure', () {
    test('a DNS lookup failure is not reported as an offline device', () {
      final error = apiErrorFromDio(
        _connectFailure(_socket("Failed host lookup: '$host'", 7)),
      );

      expect(error.kind, ApiErrorKind.network);
      expect(error.networkCause, NetworkFailureCause.dns);
      expect(error.userFacingMessage(l10n), l10n.networkCantReachServer(host));
    });

    test('getaddrinfo EAI_AGAIN counts as a DNS failure', () {
      final error = apiErrorFromDio(
        _connectFailure(_socket('Temporary failure in name resolution', -3)),
      );

      expect(error.networkCause, NetworkFailureCause.dns);
    });

    test('a refused connection says the server is not responding', () {
      final error = apiErrorFromDio(
        _connectFailure(_socket('Connection refused', 111)),
      );

      expect(error.networkCause, NetworkFailureCause.refused);
      expect(
        error.userFacingMessage(l10n),
        l10n.networkServerNotResponding,
      );
    });

    test('a connect timeout says the server is taking too long', () {
      final error = apiErrorFromDio(
        DioException(
          requestOptions: RequestOptions(path: '/health'),
          type: DioExceptionType.connectionTimeout,
          error: _socket('Connection timed out', 110),
        ),
      );

      expect(error.kind, ApiErrorKind.timeout);
      expect(error.networkCause, NetworkFailureCause.timeout);
      expect(error.userFacingMessage(l10n), l10n.networkTimeoutServer);
    });

    test('an unreachable network is a routing problem', () {
      final error = apiErrorFromDio(
        _connectFailure(_socket('Network is unreachable', 113)),
      );

      expect(error.networkCause, NetworkFailureCause.noRoute);
      expect(error.userFacingMessage(l10n), l10n.networkNoRoute);
    });

    test('an unidentified socket failure falls back to the generic copy', () {
      final error = apiErrorFromDio(
        _connectFailure(_socket('Something odd', 999)),
      );

      expect(error.networkCause, NetworkFailureCause.other);
      expect(error.userFacingMessage(l10n), l10n.networkGeneric);
    });

    test('server-caused failures never show the offline message', () {
      final error = apiErrorFromDio(
        _connectFailure(_socket('Connection refused', 111)),
      );

      expect(error.userFacingMessage(l10n), isNot(l10n.networkError));
    });

    test('English fallbacks stay in sync with the ARB copy', () {
      expect(
        apiErrorFromDio(
          _connectFailure(_socket("Failed host lookup: '$host'", 7)),
        ).userFacingMessage(),
        l10n.networkCantReachServer(host),
      );
      expect(
        apiErrorFromDio(
          _connectFailure(_socket('Connection refused', 111)),
        ).userFacingMessage(),
        l10n.networkServerNotResponding,
      );
      expect(
        apiErrorFromDio(
          DioException(
            requestOptions: RequestOptions(path: '/health'),
            type: DioExceptionType.receiveTimeout,
          ),
        ).userFacingMessage(),
        l10n.networkTimeoutServer,
      );
      expect(
        apiErrorFromDio(
          _connectFailure(_socket('Network is unreachable', 113)),
        ).userFacingMessage(),
        l10n.networkNoRoute,
      );
      expect(
        apiErrorFromDio(
          _connectFailure(_socket('Something odd', 999)),
        ).userFacingMessage(),
        l10n.networkGeneric,
      );
    });

    test('backend error envelopes keep their code and cause stays null', () {
      final error = apiErrorFromDio(
        DioException(
          requestOptions: RequestOptions(path: '/auth/google/signin'),
          type: DioExceptionType.badResponse,
          response: Response<Map<String, dynamic>>(
            requestOptions: RequestOptions(path: '/auth/google/signin'),
            statusCode: 409,
            data: {
              'error': {
                'code': 'AUTH_PHONE_ALREADY_PAIRED',
                'message': 'This phone is already paired.',
              },
            },
          ),
        ),
      );

      expect(error.code, 'AUTH_PHONE_ALREADY_PAIRED');
      expect(error.networkCause, isNull);
    });
  });
}
