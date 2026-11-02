import 'package:dio/dio.dart';

import '../env/app_env.dart';

/// Builds a bare [Dio] with the app's base options and NO interceptors.
/// Used for a single refresh call from the auth interceptor (to avoid
/// recursion) and by tests.
Dio bareDio({String? baseUrl}) => Dio(
      BaseOptions(
        baseUrl: baseUrl ?? AppEnv.apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 10),
        contentType: 'application/json',
        responseType: ResponseType.json,
        validateStatus: (code) => code != null && code >= 200 && code < 300,
      ),
    );
