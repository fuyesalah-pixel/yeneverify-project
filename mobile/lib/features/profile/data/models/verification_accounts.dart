// GET/PUT /merchants/me/verification-accounts payloads.
//
// The merchant stores their full account number per bank; the backend
// derives the suffix adapters need. A missing bank means "not configured".
// The PUT sends `null` for cleared banks so the backend merge can remove
// them (see backend/src/merchants/verification-accounts.ts).
class VerificationAccounts {
  const VerificationAccounts({
    this.cbeFull,
    this.abyssiniaFull,
    this.awashFull,
  });

  final String? cbeFull;
  final String? abyssiniaFull;
  final String? awashFull;

  factory VerificationAccounts.fromJson(Map<String, dynamic> json) {
    final payload =
        (json['verificationAccounts'] as Map<String, dynamic>?) ?? json;
    final cbe = payload['cbe'] as Map<String, dynamic>?;
    final abyssinia = payload['abyssinia'] as Map<String, dynamic>?;
    final awash = payload['awash'] as Map<String, dynamic>?;
    return VerificationAccounts(
      cbeFull: cbe?['full'] as String?,
      abyssiniaFull: abyssinia?['full'] as String?,
      awashFull: awash?['full'] as String?,
    );
  }

  bool get isEmpty =>
      cbeFull == null && abyssiniaFull == null && awashFull == null;

  /// Full-form patch: `null` clears a bank the user emptied.
  Map<String, dynamic> toPatch() => {
        'cbe': cbeFull == null ? null : {'full': cbeFull},
        'abyssinia': abyssiniaFull == null ? null : {'full': abyssiniaFull},
        'awash': awashFull == null ? null : {'full': awashFull},
      };
}
