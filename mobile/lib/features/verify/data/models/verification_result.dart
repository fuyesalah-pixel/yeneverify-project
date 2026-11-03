// Verification result + submit response (Step 13E.3 contract).
//
// bigint money arrives as a STRING over the wire (`amountMinor`) because
// JSON numbers cannot hold 64-bit precision; the field is kept as a
// string here and parsed only where a number is needed.
//
// PII rule: the backend never sends storageKey/sha256/ocr text through
// these shapes, so there is nothing to strip on the client.
enum VerificationStatus {
  pending,
  verified,
  fake,
  duplicate,
  needsReview,
  error;

  static VerificationStatus fromWire(String? value) {
    switch (value) {
      case 'VERIFIED':
        return VerificationStatus.verified;
      case 'FAKE':
        return VerificationStatus.fake;
      case 'DUPLICATE':
        return VerificationStatus.duplicate;
      case 'NEEDS_REVIEW':
        return VerificationStatus.needsReview;
      case 'ERROR':
        return VerificationStatus.error;
      case 'PENDING':
      default:
        return VerificationStatus.pending;
    }
  }

  String get wire => switch (this) {
        VerificationStatus.pending => 'PENDING',
        VerificationStatus.verified => 'VERIFIED',
        VerificationStatus.fake => 'FAKE',
        VerificationStatus.duplicate => 'DUPLICATE',
        VerificationStatus.needsReview => 'NEEDS_REVIEW',
        VerificationStatus.error => 'ERROR',
      };

  /// Terminal states stop the poll loop. PENDING keeps it running.
  bool get isTerminal =>
      this == VerificationStatus.verified ||
      this == VerificationStatus.fake ||
      this == VerificationStatus.duplicate ||
      this == VerificationStatus.needsReview ||
      this == VerificationStatus.error;

  bool get isPositive => this == VerificationStatus.verified;
}

/// Credit snapshot attached to a submit response (`balance` is a string of
/// minor units; `unlimited` means the plan does not decrement).
class SubmittedCredits {
  const SubmittedCredits({
    required this.balance,
    required this.unlimited,
    required this.lowBalance,
  });

  final String balance;
  final bool unlimited;
  final bool lowBalance;

  int get balanceValue => int.tryParse(balance) ?? 0;

  factory SubmittedCredits.fromJson(Map<String, dynamic> json) {
    return SubmittedCredits(
      balance: json['balance']?.toString() ?? '0',
      unlimited: json['unlimited'] == true,
      lowBalance: json['lowBalance'] == true,
    );
  }
}

/// POST /verifications response (202).
class VerificationSubmitted {
  const VerificationSubmitted({
    required this.verificationId,
    required this.status,
    this.credits,
    this.createdAt,
  });

  final String verificationId;
  final VerificationStatus status;
  final SubmittedCredits? credits;
  final DateTime? createdAt;

  factory VerificationSubmitted.fromJson(Map<String, dynamic> json) {
    final rawCredits = json['credits'];
    return VerificationSubmitted(
      verificationId: json['verificationId'] as String,
      status: VerificationStatus.fromWire(json['status'] as String?),
      credits: rawCredits is Map<String, dynamic>
          ? SubmittedCredits.fromJson(rawCredits)
          : null,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
    );
  }
}

/// DUPLICATE only: the verification whose receipt this one repeats.
///
/// The merchant id is included because it decides whether the original is
/// readable from this tenant — the backend 404s a foreign verification, so
/// the "View original" action treats a 404 as "another business".
class DuplicateReference {
  const DuplicateReference({
    required this.verificationId,
    required this.merchantId,
  });

  final String verificationId;
  final String merchantId;

  factory DuplicateReference.fromJson(Map<String, dynamic> json) {
    return DuplicateReference(
      verificationId: json['verificationId'] as String,
      merchantId: json['merchantId'] as String? ?? '',
    );
  }
}

/// NEEDS_REVIEW only: what the backend still needs from the user.
///
/// The supplementary data flow (POST /verifications/:id/supplementary) does
/// not exist yet — the screen explains the prompt but collects nothing.
class SupplementaryPrompt {
  const SupplementaryPrompt({required this.field, required this.hint});

  final String field;
  final String hint;

  factory SupplementaryPrompt.fromJson(Map<String, dynamic> json) {
    return SupplementaryPrompt(
      field: json['field'] as String? ?? '',
      hint: json['hint'] as String? ?? '',
    );
  }
}

/// POST /verifications/:id/request-review response (200).
class ReviewRequested {
  const ReviewRequested({
    required this.verificationId,
    required this.reviewId,
    required this.status,
  });

  final String verificationId;
  final String reviewId;
  final VerificationStatus status;

  factory ReviewRequested.fromJson(Map<String, dynamic> json) {
    return ReviewRequested(
      verificationId: json['verificationId'] as String? ?? '',
      reviewId: json['reviewId'] as String? ?? '',
      status: VerificationStatus.fromWire(json['status'] as String?),
    );
  }
}

/// GET /verifications/:id response.
class VerificationResult {
  const VerificationResult({
    required this.id,
    required this.status,
    required this.source,
    this.bankCode,
    this.bankReference,
    this.amountMinor,
    this.senderName,
    this.receiverName,
    this.paidAt,
    this.ocrConfidence,
    this.errorCode,
    this.errorMessage,
    this.durationMs,
    this.duplicateOf,
    this.needsSupplementary,
    this.receiptId,
    this.receiptMimeType,
    this.createdAt,
    this.completedAt,
  });

  final String id;
  final VerificationStatus status;
  final String source;
  final String? bankCode;
  final String? bankReference;
  final String? amountMinor;
  final String? senderName;
  final String? receiverName;
  final DateTime? paidAt;
  final double? ocrConfidence;

  /// Populated for ERROR (and sometimes NEEDS_REVIEW) outcomes.
  final String? errorCode;
  final String? errorMessage;

  final int? durationMs;

  /// DUPLICATE only — null for every other status.
  final DuplicateReference? duplicateOf;

  /// NEEDS_REVIEW only — null when the resolver needs nothing extra.
  final SupplementaryPrompt? needsSupplementary;

  final String? receiptId;
  final String? receiptMimeType;
  final DateTime? createdAt;
  final DateTime? completedAt;

  bool get isTerminal => status.isTerminal;

  /// `amountMinor` as an int for display widgets that take minor units.
  int? get amountMinorValue => int.tryParse(amountMinor ?? '');

  factory VerificationResult.fromJson(Map<String, dynamic> json) {
    final receipt = json['receipt'];
    final duplicateOf = json['duplicateOf'];
    final supplementary = json['needsSupplementary'];
    return VerificationResult(
      id: json['id'] as String,
      status: VerificationStatus.fromWire(json['status'] as String?),
      source: json['source'] as String? ?? 'TRANSACTION',
      bankCode: json['bankCode'] as String?,
      bankReference: json['bankReference'] as String?,
      amountMinor: json['amountMinor']?.toString(),
      senderName: json['senderName'] as String?,
      receiverName: json['receiverName'] as String?,
      paidAt: DateTime.tryParse(json['paidAt'] as String? ?? ''),
      ocrConfidence: (json['ocrConfidence'] as num?)?.toDouble(),
      errorCode: json['errorCode'] as String?,
      errorMessage: json['errorMessage'] as String?,
      durationMs: (json['durationMs'] as num?)?.toInt(),
      duplicateOf: duplicateOf is Map<String, dynamic>
          ? DuplicateReference.fromJson(duplicateOf)
          : null,
      needsSupplementary: supplementary is Map<String, dynamic>
          ? SupplementaryPrompt.fromJson(supplementary)
          : null,
      receiptId: receipt is Map ? receipt['id'] as String? : null,
      receiptMimeType: receipt is Map ? receipt['mimeType'] as String? : null,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      completedAt: DateTime.tryParse(json['completedAt'] as String? ?? ''),
    );
  }
}
