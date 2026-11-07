// Billing session rows: detail (GET /billing/:id) and list (GET /billing).
enum BillingStatus {
  pending,
  approved,
  mismatch,
  needsReview,
  duplicate,
  fake,
  rejected;

  static BillingStatus fromWire(String? value) {
    return switch ((value ?? '').toUpperCase()) {
      'PENDING' => BillingStatus.pending,
      'APPROVED' || 'VERIFIED' => BillingStatus.approved,
      'AMOUNT_MISMATCH' => BillingStatus.mismatch,
      'NEEDS_REVIEW' => BillingStatus.needsReview,
      'DUPLICATE' => BillingStatus.duplicate,
      'FAKE' => BillingStatus.fake,
      _ => BillingStatus.rejected,
    };
  }

  bool get isPending => this == BillingStatus.pending;
  bool get isApproved => this == BillingStatus.approved;
  bool get needsReview_ =>
      this == BillingStatus.mismatch || this == BillingStatus.needsReview;
  bool get isDeclined =>
      this == BillingStatus.fake ||
      this == BillingStatus.duplicate ||
      this == BillingStatus.rejected;
}

class BillingVerification {
  const BillingVerification({
    required this.id,
    required this.packageCode,
    required this.expectedAmountMinor,
    required this.status,
    this.submittedAmountMinor,
    this.bankCode,
    this.bankReference,
    this.senderName,
    this.paidAt,
    this.verificationId,
    this.subscriptionId,
    this.reviewNote,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String packageCode;
  final String expectedAmountMinor;
  final String? submittedAmountMinor;
  final BillingStatus status;
  final String? bankCode;
  final String? bankReference;
  final String? senderName;
  final DateTime? paidAt;
  final String? verificationId;
  final String? subscriptionId;
  final String? reviewNote;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  int get expectedAmountValue => int.tryParse(expectedAmountMinor) ?? 0;
  int? get submittedAmountValue => int.tryParse(submittedAmountMinor ?? '');

  factory BillingVerification.fromJson(Map<String, dynamic> json) {
    return BillingVerification(
      id: (json['id'] as String?) ?? '',
      packageCode: (json['packageCode'] as String?) ?? '',
      expectedAmountMinor: '${json['expectedAmountMinor'] ?? '0'}',
      submittedAmountMinor: json['submittedAmountMinor']?.toString(),
      status: BillingStatus.fromWire(json['status'] as String?),
      bankCode: json['bankCode'] as String?,
      bankReference: json['bankReference'] as String?,
      senderName: json['senderName'] as String?,
      paidAt: DateTime.tryParse(json['paidAt'] as String? ?? ''),
      verificationId: json['verificationId'] as String?,
      subscriptionId: json['subscriptionId'] as String?,
      reviewNote: json['reviewNote'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? ''),
    );
  }
}

class BillingSummary {
  const BillingSummary({
    required this.id,
    required this.packageCode,
    required this.expectedAmountMinor,
    required this.status,
    this.submittedAmountMinor,
    this.bankReference,
    this.createdAt,
  });

  final String id;
  final String packageCode;
  final String expectedAmountMinor;
  final String? submittedAmountMinor;
  final BillingStatus status;
  final String? bankReference;
  final DateTime? createdAt;

  int get expectedAmountValue => int.tryParse(expectedAmountMinor) ?? 0;

  factory BillingSummary.fromJson(Map<String, dynamic> json) {
    return BillingSummary(
      id: (json['id'] as String?) ?? '',
      packageCode: (json['packageCode'] as String?) ?? '',
      expectedAmountMinor: '${json['expectedAmountMinor'] ?? '0'}',
      submittedAmountMinor: json['submittedAmountMinor']?.toString(),
      status: BillingStatus.fromWire(json['status'] as String?),
      bankReference: json['bankReference'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
    );
  }
}

class BillingPage {
  const BillingPage({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.totalPages,
  });

  final List<BillingSummary> items;
  final int page;
  final int pageSize;
  final int total;
  final int totalPages;

  factory BillingPage.fromJson(Map<String, dynamic> json) {
    final raw = json['data'] ?? json['items'];
    final metaRaw = json['meta'];
    final meta = metaRaw is Map ? metaRaw : const {};
    return BillingPage(
      items: raw is List
          ? raw
              .whereType<Map>()
              .map((e) => BillingSummary.fromJson(Map<String, dynamic>.from(e)))
              .toList(growable: false)
          : const [],
      page: (meta['page'] as num?)?.toInt() ?? 1,
      pageSize: (meta['pageSize'] as num?)?.toInt() ?? 0,
      total: (meta['total'] as num?)?.toInt() ?? 0,
      totalPages: (meta['totalPages'] as num?)?.toInt() ?? 0,
    );
  }
}
