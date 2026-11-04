// GET /sub-merchants/:id — detail incl. the last-30-days activity summary.
import 'sub_merchant_summary.dart';

class SubMerchantDetail {
  const SubMerchantDetail({
    required this.summary,
    this.verificationCount = 0,
    this.lastVerificationAt,
    this.createdAt,
    this.updatedAt,
  });

  final SubMerchantSummary summary;
  final int verificationCount;
  final DateTime? lastVerificationAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  String get id => summary.id;
  String get name => summary.name;
  String get phone => summary.phone;
  String? get branchLabel => summary.branchLabel;
  SubMerchantStatus get status => summary.status;
  bool get isInvite => summary.isInvite;

  factory SubMerchantDetail.fromJson(Map<String, dynamic> json) {
    return SubMerchantDetail(
      summary: SubMerchantSummary.fromJson(json),
      verificationCount: (json['verificationCount'] as num?)?.toInt() ?? 0,
      lastVerificationAt:
          DateTime.tryParse(json['lastVerificationAt'] as String? ?? ''),
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? ''),
    );
  }
}
