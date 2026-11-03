// Mobile-only. Wraps the Step 13A receipts surface:
//
//   POST /receipts/presign   → reserve a storage key + upload URL
//   PUT  <uploadUrl>         → raw bytes direct to storage (NOT through /api)
//   POST /receipts/complete  → confirm the object + create the receipt row
//
// The PUT deliberately uses a bare Dio: the upload target is object storage
// (or the backend's local-driver shim), which authenticates with the
// signature/token embedded in the URL. Sending our access token there would
// leak a session credential to a third-party host.
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../../core/env/app_env.dart';
import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../../../core/network/bare_dio.dart';
import 'models/presign_response.dart';
import 'models/receipt_download.dart';
import 'models/receipt_response.dart';

/// How the image reached the app. Persisted on the receipt row and used by
/// the backend for fraud heuristics (gallery screenshots vs. camera frames).
enum InputMethod {
  photo('PHOTO'),
  upload('UPLOAD');

  const InputMethod(this.wire);
  final String wire;
}

class ReceiptsApi {
  ReceiptsApi(this._dio, {Dio? uploadDio}) : _uploadDio = uploadDio ?? bareDio();

  final Dio _dio;
  final Dio _uploadDio;

  /// Reserves a storage key and returns the upload target.
  Future<ApiResult<PresignResponse>> presign({
    required String fileName,
    required String mimeType,
    required int sizeBytes,
    required InputMethod inputMethod,
  }) async {
    return _request<PresignResponse>(
      '/receipts/presign',
      method: 'POST',
      data: {
        'fileName': fileName,
        'mimeType': mimeType,
        'sizeBytes': sizeBytes,
        'inputMethod': inputMethod.wire,
      },
      fromJson: PresignResponse.fromJson,
    );
  }

  /// PUTs the raw bytes to the presigned target.
  ///
  /// `onProgress` receives 0..1 when the transport reports a content length.
  Future<ApiResult<void>> upload({
    required PresignResponse presign,
    required List<int> bytes,
    required String mimeType,
    void Function(double progress)? onProgress,
  }) async {
    // Storage flavours differ in whether Content-Type is part of the
    // signature. Honour the backend's headers first, then default to the
    // mime type so the local driver and plain S3-style buckets both work.
    final headers = <String, String>{...presign.headers};
    final hasContentType = headers.keys.any(
      (k) => k.toLowerCase() == 'content-type',
    );

    if (presign.method == 'POST') {
      // Multipart fallback: not emitted by the current drivers, but the
      // contract allows it, so support it rather than silently 404.
      final form = FormData.fromMap({
        'file': MultipartFile.fromBytes(bytes, filename: 'receipt.jpg'),
      });
      try {
        await _uploadDio.post<dynamic>(
          _reachableUploadUrl(presign.uploadUrl),
          data: form,
          options: Options(
            headers: hasContentType ? headers : {...headers, 'Content-Type': mimeType},
          ),
          onSendProgress: _progressReporter(onProgress),
        );
        return const Success(null);
      } on DioException catch (e) {
        return Failure(_uploadFailure(e));
      }
    }

    try {
      await _uploadDio.put<dynamic>(
        _reachableUploadUrl(presign.uploadUrl),
        // Raw bytes with a known length so onSendProgress reports a real
        // percentage and the PUT is not chunked.
        data: bytes,
        options: Options(
          // Only add Content-Type when the signature did not bind one, so
          // Dio cannot emit a duplicate header and break an R2 signature.
          headers: headers,
          contentType: hasContentType ? null : mimeType,
          // Storage replies with XML/JSON/empty bodies depending on driver;
          // never try to parse, only the status code matters.
          responseType: ResponseType.plain,
          validateStatus: (code) => code != null && code >= 200 && code < 300,
        ),
        onSendProgress: _progressReporter(onProgress),
      );
      return const Success(null);
    } on DioException catch (e) {
      return Failure(_uploadFailure(e));
    } catch (e) {
      return Failure(ApiError(code: 'NETWORK_ERROR', message: e.toString()));
    }
  }

  /// Confirms the uploaded object and creates the receipt row.
  Future<ApiResult<ReceiptResponse>> complete({
    required String storageKey,
    required InputMethod inputMethod,
    required String sha256,
    int? width,
    int? height,
  }) async {
    return _request<ReceiptResponse>(
      '/receipts/complete',
      method: 'POST',
      data: {
        'storageKey': storageKey,
        'inputMethod': inputMethod.wire,
        'sha256': sha256,
        if (width != null) 'width': width,
        if (height != null) 'height': height,
      },
      fromJson: ReceiptResponse.fromJson,
    );
  }

  /// Resolves the short-lived download URL for a stored receipt.
  ///
  /// The URL is a presigned GET (300 s TTL) — hand it straight to the image
  /// widget and never persist it.
  Future<ApiResult<ReceiptDownload>> getById(String receiptId) async {
    final result = await _request<ReceiptDownload>(
      '/receipts/$receiptId',
      method: 'GET',
      fromJson: ReceiptDownload.fromJson,
    );
    return switch (result) {
      Success(:final data) => Success(
          data.copyWith(downloadUrl: _reachableUploadUrl(data.downloadUrl)),
        ),
      Failure(:final error) => Failure(error),
    };
  }

  // ── internals ──────────────────────────────────────────────────────────

  /// The local driver mints absolute URLs from the backend's APP_URL
  /// (`http://localhost:3000` by default). Inside the Android emulator
  /// `localhost` is the emulator itself, so rewrite a loopback upload host
  /// to the host the app already uses to reach the API (10.0.2.2 on the
  /// emulator, a LAN IP on a physical device).
  static String _reachableUploadUrl(String uploadUrl) {
    final uri = Uri.tryParse(uploadUrl);
    if (uri == null || uri.host.isEmpty) return uploadUrl;
    if (uri.host != 'localhost' && uri.host != '127.0.0.1') return uploadUrl;

    final api = Uri.tryParse(AppEnv.apiBaseUrl);
    if (api == null || api.host.isEmpty) return uploadUrl;

    final rewritten = uri.replace(
      scheme: api.scheme,
      host: api.host,
      port: uri.hasPort ? uri.port : null,
    );
    if (kDebugMode && rewritten.toString() != uploadUrl) {
      debugPrint('[verify] rewrote upload host ${uri.host} → ${api.host}');
    }
    return rewritten.toString();
  }

  static void Function(int, int)? _progressReporter(
    void Function(double)? onProgress,
  ) {
    if (onProgress == null) return null;
    return (sent, total) {
      if (total <= 0) return;
      final value = (sent / total).clamp(0.0, 1.0);
      onProgress(value);
    };
  }

  ApiError _uploadFailure(DioException e) {
    // A storage rejection is never an auth problem for OUR session, so map
    // 4xx/5xx to the dedicated code the UI knows how to explain.
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return const ApiError(code: 'NETWORK_ERROR', kind: ApiErrorKind.network);
    }
    return ApiError(
      code: 'RECEIPT_NOT_UPLOADED',
      message: e.message,
      httpStatus: e.response?.statusCode,
    );
  }

  Future<ApiResult<T>> _request<T>(
    String path, {
    required String method,
    required T Function(Map<String, dynamic>) fromJson,
    Map<String, dynamic>? data,
  }) async {
    try {
      final res = await _dio.request<Map<String, dynamic>>(
        path,
        data: data,
        options: Options(method: method),
      );
      final body = res.data ?? const <String, dynamic>{};
      final payload = (body['data'] as Map<String, dynamic>?) ?? body;
      return Success(fromJson(payload));
    } on DioException catch (e) {
      return Failure(apiErrorFromDio(e));
    } catch (e) {
      return Failure(ApiError(message: e.toString()));
    }
  }
}
