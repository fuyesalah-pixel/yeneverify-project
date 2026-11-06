// POST /onboarding/merchant request.
// Contract: backend/src/onboarding/dto/create-merchant.dto.ts
class CreateMerchantRequest {
  const CreateMerchantRequest({
    required this.businessName,
    this.businessType,
    this.tin,
    this.address,
    this.city,
    this.region,
    this.verificationAccounts,
  });

  final String businessName;
  final String? businessType;
  final String? tin;
  final String? address;
  final String? city;
  final String? region;
  final Map<String, dynamic>? verificationAccounts;

  Map<String, dynamic> toJson() => {
        'businessName': businessName,
        if (businessType != null) 'businessType': businessType,
        if (tin != null && tin!.isNotEmpty) 'tin': tin,
        if (address != null && address!.isNotEmpty) 'address': address,
        if (city != null && city!.isNotEmpty) 'city': city,
        if (region != null && region!.isNotEmpty) 'region': region,
        if (verificationAccounts != null)
          'verificationAccounts': verificationAccounts,
      };
}
