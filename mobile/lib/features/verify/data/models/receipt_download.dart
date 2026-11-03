// GET /receipts/:id — the short-lived read URL for a stored receipt.
//
// The backend signs a GET for 300 s, so this URL is used immediately by the
// preview sheet and never cached or persisted.
class ReceiptDownload {
  const ReceiptDownload({
    required this.receiptId,
    required this.downloadUrl,
    required this.mimeType,
    this.expiresAt,
  });

  final String receiptId;
  final String downloadUrl;
  final String mimeType;
  final DateTime? expiresAt;

  ReceiptDownload copyWith({String? downloadUrl}) => ReceiptDownload(
        receiptId: receiptId,
        downloadUrl: downloadUrl ?? this.downloadUrl,
        mimeType: mimeType,
        expiresAt: expiresAt,
      );

  factory ReceiptDownload.fromJson(Map<String, dynamic> json) {
    return ReceiptDownload(
      receiptId: json['receiptId'] as String? ?? '',
      downloadUrl: json['downloadUrl'] as String? ?? '',
      mimeType: json['mimeType'] as String? ?? 'image/jpeg',
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? ''),
    );
  }
}
