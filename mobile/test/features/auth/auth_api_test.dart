// Contract tests for AuthApi (Step 21). Uses a fake Dio adapter, so the
// request paths/bodies and the backend envelope parsing are exercised without
// a server or any platform plugin.
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/features/auth/data/auth_api.dart';
import 'package:yene_verify/features/auth/data/models/auth_models.dart';

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.respond);

  final ResponseBody Function(RequestOptions options) respond;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(Object body, {int status = 200}) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

AuthApi _api(_FakeAdapter adapter) {
  final dio = Dio(BaseOptions(
    baseUrl: 'http://test.local/api/v1',
    validateStatus: (code) => code != null && code >= 200 && code < 300,
  ));
  dio.httpClientAdapter = adapter;
  return AuthApi(dio);
}

void main() {
  test('setPin posts the PIN to /auth/pin/set with no body parsing', () async {
    final adapter = _FakeAdapter((_) => _json({'success': true}));

    final result = await _api(adapter).setPin(pin: '1234');

    expect(result, isA<Success<void>>());
    final request = adapter.requests.single;
    expect(request.path, '/auth/pin/set');
    expect(request.method, 'POST');
    expect(request.data, {'pin': '1234'});
  });

  test('verifyPin returns the step-up token', () async {
    final adapter = _FakeAdapter(
      (_) => _json({
        'success': true,
        'data': {'stepUpToken': 'step-up-1', 'expiresIn': 120},
      }),
    );

    final result = await _api(adapter).verifyPin(pin: '1234');

    expect(result, isA<Success<StepUpResponse>>());
    expect((result as Success<StepUpResponse>).data.stepUpToken, 'step-up-1');
  });

  test('unlock sends BIOMETRIC and parses flat tokens', () async {
    final adapter = _FakeAdapter(
      (_) => _json({
        'accessToken': 'access-2',
        'refreshToken': 'refresh-2',
        'expiresIn': 900,
      }),
    );

    final result = await _api(adapter).unlock(
      refreshToken: 'refresh-1',
      device: {'fingerprint': 'fp-1', 'platform': 'ANDROID'},
      method: UnlockMethod.biometric,
    );

    expect(result, isA<Success<FlatTokensResponse>>());
    expect((result as Success<FlatTokensResponse>).data.tokens.refreshToken,
        'refresh-2');
    expect(adapter.requests.single.data, {
      'refreshToken': 'refresh-1',
      'device': {'fingerprint': 'fp-1', 'platform': 'ANDROID'},
      'unlockMethod': 'BIOMETRIC',
    });
  });

  test('maps a backend error envelope to a typed ApiError', () async {
    final adapter = _FakeAdapter(
      (_) => _json(
        {
          'success': false,
          'error': {
            'code': 'AUTH_PIN_INVALID',
            'message': 'Invalid PIN',
          },
        },
        status: 400,
      ),
    );

    final result = await _api(adapter).verifyPin(pin: '9999');

    expect(result, isA<Failure<StepUpResponse>>());
    final error = (result as Failure<StepUpResponse>).error;
    expect(error.code, 'AUTH_PIN_INVALID');
    expect(error.httpStatus, 400);
    expect(error.userFacingMessage(), contains('Incorrect PIN'));
  });

  test('maps a connection failure to a network ApiError', () async {
    final dio = Dio(BaseOptions(baseUrl: 'http://test.local/api/v1'));
    dio.httpClientAdapter = _ThrowingAdapter();
    final result = await AuthApi(dio).setPin(pin: '1234');

    expect(result, isA<Failure<void>>());
    expect((result as Failure<void>).error.isNetwork, isTrue);
  });
}

class _ThrowingAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    throw DioException.connectionError(
      requestOptions: options,
      reason: 'offline',
    );
  }

  @override
  void close({bool force = false}) {}
}
