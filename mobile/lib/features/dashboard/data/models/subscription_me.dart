// GET /subscription/me — plan, credit balance and expiry.
//
// `creditsBalance` is a string of minor units? No: credits are whole units,
// the backend stringifies them anyway, so the same parse applies.
class SubscriptionMe {
  const SubscriptionMe({
    required this.packageCode,
    required this.packageName,
    required this.unlimited,
    required this.creditsBalance,
    required this.lowBalance,
    this.status,
    this.daysRemaining,
    this.expiresAt,
  });

  final String packageCode;
  final String packageName;
  final bool unlimited;
  final String creditsBalance;
  final bool lowBalance;
  final String? status;
  final int? daysRemaining;
  final DateTime? expiresAt;

  int get creditsValue => int.tryParse(creditsBalance) ?? 0;

  factory SubscriptionMe.fromJson(Map<String, dynamic> json) {
    return SubscriptionMe(
      packageCode: (json['packageCode'] as String?) ?? '',
      packageName: (json['packageName'] as String?) ?? '',
      unlimited: json['unlimited'] == true,
      creditsBalance: '${json['creditsBalance'] ?? '0'}',
      lowBalance: json['lowBalance'] == true,
      status: json['status'] as String?,
      daysRemaining: (json['daysRemaining'] as num?)?.toInt(),
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? ''),
    );
  }
}
