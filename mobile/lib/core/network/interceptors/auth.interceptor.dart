import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../bare_dio.dart';
import '../token_store.dart';

/// Paths that never receive a Bearer token and never trigger the 401
/// refresh dance (they are the refresh dance).
const _publicAuthPaths = {
  '/auth/request-otp',
  '/auth/verify-otp',
  '/auth/refresh',
  '/auth/unlock',
  '/auth/step-up/biometric',
  '/auth/pin/reset',
};

/// # AuthInterceptor
///
/// - Attaches `Authorization: Bearer <accessToken>` to authed requests.
/// - On a 401 from anything else: performs one silent `POST /auth/refresh`
///   with the stored refresh token, retries the original request once, and
///   force-logs-out (clears tokens + notifies auth state) if refresh fails.
class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._ref, this._tokens);

  final Ref _ref;
  final InMemoryTokenStore _tokens;
  final _refreshLock = Lock();

  bool _isPublicAuthPath(String path) =>
      _publicAuthPaths.any(path.startsWith);

  bool _isRefreshCall(RequestOptions options) =>
      options.path.startsWith('/auth/refresh');

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = _tokens.accessToken;
    if (token != null && !_isPublicAuthPath(options.path)) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final response = err.response;

    if (response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    // A 401 from /auth/refresh means the session is dead.
    if (_isRefreshCall(err.requestOptions)) {
      await _forceLogout();
      handler.next(err);
      return;
    }

    // Public auth calls (request-otp / verify-otp / unlock) legitimately return
    // 401 for bad input; the session, if any, is still valid.
    if (_isPublicAuthPath(err.requestOptions.path)) {
      handler.next(err);
      return;
    }

    // Never retry the same request twice.
    if (err.requestOptions.extra.containsKey(_kAuthRetriedKey)) {
      handler.next(err);
      return;
    }

    final refreshed = await _refreshLock.synchronized(() async {
      try {
        final gateway = _ref.read(tokenGatewayProvider);
        final refreshToken = gateway.readRefreshToken();
        if (refreshToken == null || refreshToken.isEmpty) return false;

        final response = await bareDio().post(
          '/auth/refresh',
          data: {'refreshToken': refreshToken},
        );

        final body = response.data;
        final data = body is Map && body['data'] is Map
            ? body['data'] as Map
            : body is Map
                ? body
                : const <String, dynamic>{};
        final newAccess = data['accessToken'] as String?;
        final newRefresh = data['refreshToken'] as String?;
        if (newAccess == null) return false;

        _tokens.set(newAccess);
        if (newRefresh != null) await gateway.writeRefreshToken(newRefresh);
        return true;
      } catch (_) {
        return false;
      }
    });

    if (!refreshed) {
      await _forceLogout();
      handler.next(err);
      return;
    }

    // Retry the original request with the new token.
    try {
      final response = await _retry(err.requestOptions);
      handler.resolve(response);
    } on DioException catch (retryErr) {
      handler.next(retryErr);
    }
  }

  Future<void> _forceLogout() async {
    final gateway = _ref.read(tokenGatewayProvider);
    _tokens.clear();
    try {
      await gateway.clear();
    } catch (_) {
      // Local state clearing must never throw.
    }
    gateway.onSessionExpired?.call();
  }

  Future<Response<dynamic>> _retry(RequestOptions requestOptions) {
    final dio = bareDio();
    requestOptions.extra[_kAuthRetriedKey] = true;
    final token = _tokens.accessToken;
    if (token != null) {
      requestOptions.headers['Authorization'] = 'Bearer $token';
    }
    return dio.fetch(requestOptions);
  }

  static const _kAuthRetriedKey = '_yv_auth_retried';
}

/// Minimal mutex used to serialize concurrent 401 refreshes.
class Lock {
  Future<void> _lock = Future.value();

  Future<T> synchronized<T>(Future<T> Function() body) {
    final completer = Completer<void>();
    final previous = _lock;
    _lock = completer.future;
    return previous.then((_) => body()).whenComplete(() {
      completer.complete();
    });
  }
}
