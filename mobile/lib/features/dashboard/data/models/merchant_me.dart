// GET /merchants/me — the merchant profile the dashboard header renders.
//
// The backend returns the raw Prisma row (spread) plus `currentSubscription`
// and `_count`; `creditsBalance` is stringified because it is a bigint.
// There is deliberately no `counts` object and no 30-day field here — the
// last-30-days numbers come from /analytics/summary.
class MerchantMe {
  const MerchantMe({
    required this.id,
    required this.businessName,
    required this.status,
    required this.creditsBalance,
    this.businessType,
    this.tin,
    this.city,
    this.currentPackageCode,
    this.currentSubscription,
    this.subMerchantCount = 0,
    this.transactionCount = 0,
    this.verificationCount = 0,
  });

  final String id;
  final String businessName;
  final String status;
  final String creditsBalance;
  final String? businessType;
  final String? tin;
  final String? city;
  final String? currentPackageCode;
  final MerchantSubscription? currentSubscription;

  /// All-time counts from `_count` — never label these "last 30 days".
  final int subMerchantCount;
  final int transactionCount;
  final int verificationCount;

  int get creditsValue => int.tryParse(creditsBalance) ?? 0;

  factory MerchantMe.fromJson(Map<String, dynamic> json) {
    final subscription = json['currentSubscription'];
    final counts = json['_count'];
    int countOf(String key) =>
        counts is Map ? ((counts[key] as num?)?.toInt() ?? 0) : 0;

    return MerchantMe(
      id: (json['id'] as String?) ?? '',
      businessName: (json['businessName'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'ACTIVE',
      creditsBalance: '${json['creditsBalance'] ?? '0'}',
      businessType: json['businessType'] as String?,
      tin: json['tin'] as String?,
      city: json['city'] as String?,
      currentPackageCode: json['currentPackageCode'] as String?,
      currentSubscription: subscription is Map<String, dynamic>
          ? MerchantSubscription.fromJson(subscription)
          : null,
      subMerchantCount: countOf('subMerchants'),
      transactionCount: countOf('transactions'),
      verificationCount: countOf('verifications'),
    );
  }
}

/// Nested `currentSubscription` on the merchant profile.
class MerchantSubscription {
  const MerchantSubscription({
    required this.id,
    required this.packageCode,
    required this.status,
    this.expiresAt,
  });

  final String id;
  final String packageCode;
  final String status;
  final DateTime? expiresAt;

  factory MerchantSubscription.fromJson(Map<String, dynamic> json) {
    return MerchantSubscription(
      id: (json['id'] as String?) ?? '',
      packageCode: (json['packageCode'] as String?) ?? '',
      status: (json['status'] as String?) ?? '',
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? ''),
    );
  }
}
