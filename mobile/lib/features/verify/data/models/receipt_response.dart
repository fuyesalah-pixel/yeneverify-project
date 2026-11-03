// POST /receipts/complete response. The receipt row now exists server-side
// and can be submitted for verification by id.
class ReceiptResponse {
  const ReceiptResponse({
    required this.receiptId,
    required this.storageKey,
    required this.sizeBytes,
    this.createdAt,
  });

  final String receiptId;
  final String storageKey;
  final int sizeBytes;
  final DateTime? createdAt;

  factory ReceiptResponse.fromJson(Map<String, dynamic> json) {
    return ReceiptResponse(
      receiptId: json['receiptId'] as String,
      storageKey: json['storageKey'] as String? ?? '',
      sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
    );
  }
}
