// POST /onboarding/merchant response.
//
// The backend returns `{ merchant: { ... }, subscription: { ... } }` (201),
// not a flat merchant object — verified against onboarding.service.ts.
class CreateMerchantResponse {
  const CreateMerchantResponse({
    required this.merchantId,
    required this.businessName,
    required this.status,
    required this.currentPackageCode,
    required this.creditsBalance,
    this.createdAt,
  });

  final String merchantId;
  final String businessName;
  final String status;
  final String currentPackageCode;

  /// bigint is serialized as a string by the backend.
  final String creditsBalance;

  final String? createdAt;

  factory CreateMerchantResponse.fromJson(Map<String, dynamic> json) {
    final merchant = (json['merchant'] as Map?)?.cast<String, dynamic>() ?? json;
    return CreateMerchantResponse(
      merchantId: (merchant['merchantId'] ?? merchant['id']) as String,
      businessName: (merchant['businessName'] as String?) ?? '',
      status: (merchant['status'] as String?) ?? 'ACTIVE',
      currentPackageCode:
          (merchant['currentPackageCode'] as String?) ?? 'FREE',
      creditsBalance: '${merchant['creditsBalance'] ?? '0'}',
      createdAt: merchant['createdAt'] as String?,
    );
  }
}

/// POST /sub-merchants/accept response (200).
class AcceptInviteResponse {
  const AcceptInviteResponse({
    required this.subMerchantId,
    required this.merchantId,
  });

  final String subMerchantId;
  final String merchantId;

  factory AcceptInviteResponse.fromJson(Map<String, dynamic> json) =>
      AcceptInviteResponse(
        subMerchantId: json['subMerchantId'] as String,
        merchantId: json['merchantId'] as String,
      );
}
