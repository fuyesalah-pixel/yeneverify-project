import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// # CheapLoggingInterceptor
///
/// Debug-only request telemetry: method, path, status, duration. NEVER logs
/// request/response bodies or headers (tokens and phone numbers live there).
/// Attached only in debug builds; release builds get no logging.
class CheapLoggingInterceptor extends Interceptor {
  final _sw = <RequestOptions, Stopwatch>{};

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _sw[options] = Stopwatch()..start();
    handler.next(options);
  }

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    _log(response.requestOptions, response.statusCode ?? 0);
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _log(err.requestOptions, err.response?.statusCode ?? -1, failed: true);
    handler.next(err);
  }

  void _log(RequestOptions options, int status, {bool failed = false}) {
    final sw = _sw.remove(options);
    final ms = sw == null ? 0 : sw.elapsedMilliseconds;
    debugPrint(
      '[api] ${options.method} ${options.uri.path} '
      '${failed ? 'FAIL' : status} ${ms}ms',
    );
  }
}
