// POST /billing/initiate — the payment instructions + session id that the
// upload step submits against.
class PaymentInstructions {
  const PaymentInstructions({
    required this.cbeAccountNumber,
    required this.cbeAccountName,
    required this.telebirrPhoneNumber,
    required this.telebirrAccountName,
    this.note = '',
  });

  final String cbeAccountNumber;
  final String cbeAccountName;
  final String telebirrPhoneNumber;
  final String telebirrAccountName;
  final String note;

  factory PaymentInstructions.fromJson(Map<String, dynamic> json) {
    final cbe = json['cbe'];
    final telebirr = json['telebirr'];
    final cbeMap = cbe is Map ? cbe : const {};
    final telebirrMap = telebirr is Map ? telebirr : const {};
    return PaymentInstructions(
      cbeAccountNumber: '${cbeMap['accountNumber'] ?? ''}',
      cbeAccountName: '${cbeMap['accountName'] ?? ''}',
      telebirrPhoneNumber: '${telebirrMap['phoneNumber'] ?? ''}',
      telebirrAccountName: '${telebirrMap['accountName'] ?? ''}',
      note: (json['note'] as String?) ?? '',
    );
  }
}

class BillingSession {
  const BillingSession({
    required this.billingSessionId,
    required this.packageCode,
    required this.packageName,
    required this.expectedAmountMinor,
    required this.currency,
    required this.instructions,
  });

  final String billingSessionId;
  final String packageCode;
  final String packageName;

  /// bigint minor units as string.
  final String expectedAmountMinor;
  final String currency;
  final PaymentInstructions instructions;

  int get expectedAmountValue => int.tryParse(expectedAmountMinor) ?? 0;

  factory BillingSession.fromJson(Map<String, dynamic> json) {
    final instructions = json['instructions'];
    return BillingSession(
      billingSessionId: (json['billingSessionId'] as String?) ?? '',
      packageCode: (json['packageCode'] as String?) ?? '',
      packageName: (json['packageName'] as String?) ?? '',
      expectedAmountMinor: '${json['expectedAmountMinor'] ?? '0'}',
      currency: (json['currency'] as String?) ?? 'ETB',
      instructions: PaymentInstructions.fromJson(
        instructions is Map ? Map<String, dynamic>.from(instructions) : const {},
      ),
    );
  }
}

/// POST /billing/submit — the queued verification ids.
class BillingSubmitted {
  const BillingSubmitted({
    required this.billingVerificationId,
    required this.verificationId,
    this.status = 'PENDING',
  });

  final String billingVerificationId;
  final String verificationId;
  final String status;

  factory BillingSubmitted.fromJson(Map<String, dynamic> json) {
    return BillingSubmitted(
      billingVerificationId: (json['billingVerificationId'] as String?) ?? '',
      verificationId: (json['verificationId'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'PENDING',
    );
  }
}
