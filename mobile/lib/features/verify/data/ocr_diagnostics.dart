// OCR / bank-endpoint diagnostics (debug-only).
//
// Reads GET /health/ocr (provider, fixture count, bank probes) and
// GET /health/ready (dependency health) — both public ops surfaces outside the
// versioned API prefix. The verify screen uses them to say, on a device,
// whether the backend is really reading receipts or falling back to an empty
// mock fixture map.
import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/env/app_env.dart';
import '../../../core/network/bare_dio.dart';

/// One bank endpoint probe reported by the backend.
class BankProbe {
  const BankProbe({
    required this.bankCode,
    this.endpoint,
    this.reachable,
    this.status,
    this.latencyMs,
    this.error,
  });

  final String bankCode;

  /// null when the bank has no single probe URL (adapter-owned, multi-URL).
  final String? endpoint;

  /// null = not probed; never assumed reachable.
  final bool? reachable;
  final int? status;
  final int? latencyMs;
  final String? error;

  factory BankProbe.fromJson(Map<String, dynamic> json) => BankProbe(
        bankCode: json['bankCode'] as String? ?? '?',
        endpoint: json['endpoint'] as String?,
        reachable: json['reachable'] as bool?,
        status: (json['status'] as num?)?.toInt(),
        latencyMs: (json['latencyMs'] as num?)?.toInt(),
        error: json['error'] as String?,
      );

  String get host {
    final uri = endpoint == null ? null : Uri.tryParse(endpoint!);
    return uri?.host ?? 'no probe URL';
  }
}

/// The OCR entry from GET /health/ready.
class ReadyStatus {
  const ReadyStatus({
    required this.status,
    this.ocrStatus,
    this.ocrMessage,
  });

  /// Overall probe status (`ok`, `error`, `shutting_down`).
  final String status;

  /// `up`, `degraded`, or `down`. null when OCR was not part of the response.
  final String? ocrStatus;
  final String? ocrMessage;

  factory ReadyStatus.fromJson(Map<String, dynamic> json) {
    // Terminus puts a failing indicator under `error`, a passing one under
    // `info`; `details` always holds both.
    final details = json['details'] as Map<String, dynamic>? ?? const {};
    final ocr = details['ocr'] as Map<String, dynamic>?;

    return ReadyStatus(
      status: json['status'] as String? ?? 'unknown',
      ocrStatus: ocr?['status'] as String?,
      ocrMessage: ocr?['message'] as String?,
    );
  }
}

/// Snapshot returned by GET /health/ocr.
class OcrDiagnostics {
  const OcrDiagnostics({
    required this.provider,
    required this.fixtures,
    required this.hint,
    required this.bankAdapterMock,
    required this.banks,
    this.ready,
  });

  final String provider;
  final int fixtures;
  final String hint;
  final bool bankAdapterMock;
  final List<BankProbe> banks;

  /// null when /health/ready could not be reached.
  final ReadyStatus? ready;

  bool get isMock => provider == 'mock';

  /// Banner text: the fixture count is the number that decides whether a real
  /// receipt can verify at all.
  String get bannerLabel {
    if (!isMock) return 'Dev: OCR $provider';
    if (fixtures == 0) {
      return 'Dev: OCR mocked, 0 fixtures — real receipts will fail';
    }
    return 'Dev: OCR mocked, $fixtures fixtures';
  }

  factory OcrDiagnostics.fromJson(
    Map<String, dynamic> json, {
    ReadyStatus? ready,
  }) =>
      OcrDiagnostics(
        provider: json['provider'] as String? ?? 'unknown',
        fixtures: (json['fixtures'] as num?)?.toInt() ?? 0,
        hint: json['hint'] as String? ?? '',
        bankAdapterMock: json['bankAdapterMock'] as bool? ?? false,
        banks: (json['banks'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(BankProbe.fromJson)
            .toList(growable: false),
        ready: ready,
      );
}

/// Fetches both probes once and keeps the result for 60s, so opening the
/// diagnostics sheet repeatedly does not hammer the backend.
///
/// Null on any failure — the banner is a dev aid, never an error surface.
final ocrDiagnosticsProvider =
    FutureProvider.autoDispose<OcrDiagnostics?>((ref) async {
  final link = ref.keepAlive();
  final timer = Timer(const Duration(seconds: 60), link.close);
  ref.onDispose(timer.cancel);

  final dio = bareDio(baseUrl: AppEnv.healthBaseUrl);
  try {
    final results = await Future.wait([
      _getJson(dio, '/health/ocr'),
      _getJson(dio, '/health/ready'),
    ]);
    final ocr = results[0];
    if (ocr == null) return null;

    final ready = results[1];
    return OcrDiagnostics.fromJson(
      ocr,
      ready: ready == null ? null : ReadyStatus.fromJson(ready),
    );
  } finally {
    dio.close(force: true);
  }
});

/// Health probes answer 4xx/5xx for unhealthy dependencies, so the body is
/// read regardless of status instead of being thrown away as an error.
Future<Map<String, dynamic>?> _getJson(Dio dio, String path) async {
  try {
    final response = await dio.get<Map<String, dynamic>>(
      path,
      options: Options(
        validateStatus: (_) => true,
        sendTimeout: const Duration(seconds: 3),
        receiveTimeout: const Duration(seconds: 8),
      ),
    );
    return response.data;
  } on DioException {
    return null;
  }
}
