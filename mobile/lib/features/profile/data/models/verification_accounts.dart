// GET/PUT /merchants/me/verification-accounts payloads.
//
// Every field is optional: a missing bank means "not configured". The
// PUT sends `null` for cleared values so the backend merge can remove
// them (see backend/src/merchants/verification-accounts.ts).
class VerificationAccounts {
  const VerificationAccounts({
    this.cbeLast8,
    this.abyssiniaLast5,
    this.awashAccountNumber,
  });

  final String? cbeLast8;
  final String? abyssiniaLast5;
  final String? awashAccountNumber;

  factory VerificationAccounts.fromJson(Map<String, dynamic> json) {
    final payload =
        (json['verificationAccounts'] as Map<String, dynamic>?) ?? json;
    final cbe = payload['cbe'] as Map<String, dynamic>?;
    final abyssinia = payload['abyssinia'] as Map<String, dynamic>?;
    final awash = payload['awash'] as Map<String, dynamic>?;
    return VerificationAccounts(
      cbeLast8: cbe?['last8'] as String?,
      abyssiniaLast5: abyssinia?['last5'] as String?,
      awashAccountNumber: awash?['accountNumber'] as String?,
    );
  }

  bool get isEmpty =>
      cbeLast8 == null && abyssiniaLast5 == null && awashAccountNumber == null;

  /// Full-form patch: `null` clears a bank the user emptied.
  Map<String, dynamic> toPatch() => {
        'cbe': cbeLast8 == null ? null : {'last8': cbeLast8},
        'abyssinia': abyssiniaLast5 == null ? null : {'last5': abyssiniaLast5},
        'awash': awashAccountNumber == null
            ? null
            : {'accountNumber': awashAccountNumber},
      };
}
