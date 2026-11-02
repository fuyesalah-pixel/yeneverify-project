import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../env/app_env.dart';
import 'token_store.dart';
import 'interceptors/auth.interceptor.dart';
import 'interceptors/cheap_logging.interceptor.dart';

/// # DioClient
///
/// The single [Dio] used by the whole app. Backed by [AppEnv.apiBaseUrl],
/// which is `http://10.0.2.2:3000/api/v1` on the emulator by default and is
/// overridden by `--dart-define=API_BASE_URL=...` for a physical device or
/// production.
///
/// - Auth interceptor attaches the in-memory access token and handles 401s.
/// - Logging runs only in debug builds and never logs bodies/headers.
final dioProvider = Provider<Dio>((ref) {
  final tokens = ref.watch(inMemoryTokenStoreProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: AppEnv.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 10),
      contentType: 'application/json',
      responseType: ResponseType.json,
      headers: {'Accept': 'application/json'},
      // Treat every non-2xx as an error so the auth interceptor can see 401
      // and the typed error mapper can read the backend envelope.
      validateStatus: (code) => code != null && code >= 200 && code < 300,
    ),
  );

  dio.interceptors.addAll([
    AuthInterceptor(ref, tokens),
    if (kDebugMode && AppEnv.isDev) CheapLoggingInterceptor(),
  ]);

  return dio;
});

