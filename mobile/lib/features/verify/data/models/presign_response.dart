// POST /receipts/presign response (Step 13A two-step upload).
//
// The backend decides the transport: `method` is PUT for both the R2 and
// the local driver, and `headers` carries whatever the signature binds
// (Content-Type included when the driver signs it). Clients must send
// those headers verbatim — a signed PUT with the wrong Content-Type is
// rejected by R2 with a signature mismatch.
class PresignResponse {
  const PresignResponse({
    required this.storageKey,
    required this.uploadUrl,
    required this.method,
    required this.headers,
    this.expiresAt,
  });

  final String storageKey;

  /// Absolute upload target. For the local driver this points at
  /// `${APP_URL}/api/v1/internal/storage-upload/<key>?token=…`.
  final String uploadUrl;

  /// 'PUT' (standard) or 'POST' (multipart, not used by the current drivers).
  final String method;

  final Map<String, String> headers;
  final DateTime? expiresAt;

  factory PresignResponse.fromJson(Map<String, dynamic> json) {
    final rawHeaders = json['headers'];
    final headers = <String, String>{};
    if (rawHeaders is Map) {
      rawHeaders.forEach((key, value) {
        if (key is String && value != null) headers[key] = value.toString();
      });
    }

    return PresignResponse(
      storageKey: json['storageKey'] as String,
      uploadUrl: json['uploadUrl'] as String,
      method: (json['method'] as String? ?? 'PUT').toUpperCase(),
      headers: headers,
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? ''),
    );
  }
}
