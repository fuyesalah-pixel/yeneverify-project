// GET /verifications list row + page envelope.
//
// The backend wraps the page once more than other endpoints:
//   { success, data: { data: [...], meta: {...} }, meta: { requestId } }
// so the parser accepts both the nested and the flat shape.
import 'verification_result.dart';

class VerificationSummary {
  const VerificationSummary({
    required this.id,
    required this.status,
    this.bankCode,
    this.bankReference,
    this.amountMinor,
    this.createdAt,
    this.completedAt,
  });

  final String id;
  final VerificationStatus status;
  final String? bankCode;
  final String? bankReference;
  final String? amountMinor;
  final DateTime? createdAt;
  final DateTime? completedAt;

  int? get amountMinorValue => int.tryParse(amountMinor ?? '');

  DateTime? get occurredAt => completedAt ?? createdAt;

  factory VerificationSummary.fromJson(Map<String, dynamic> json) {
    return VerificationSummary(
      id: (json['id'] as String?) ?? '',
      status: VerificationStatus.fromWire(json['status'] as String?),
      bankCode: json['bankCode'] as String?,
      bankReference: json['bankReference'] as String?,
      amountMinor: json['amountMinor']?.toString(),
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      completedAt: DateTime.tryParse(json['completedAt'] as String? ?? ''),
    );
  }
}

class VerificationPage {
  const VerificationPage({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.totalPages,
  });

  final List<VerificationSummary> items;
  final int page;
  final int pageSize;
  final int total;
  final int totalPages;

  factory VerificationPage.fromJson(Map<String, dynamic> json) {
    final rawItems = json['data'];
    final meta = json['meta'];
    final metaMap = meta is Map ? meta : const {};
    return VerificationPage(
      items: rawItems is List
          ? rawItems
              .whereType<Map>()
              .map((e) => VerificationSummary.fromJson(
                    Map<String, dynamic>.from(e),
                  ))
              .toList(growable: false)
          : const [],
      page: (metaMap['page'] as num?)?.toInt() ?? 1,
      pageSize: (metaMap['pageSize'] as num?)?.toInt() ?? 0,
      total: (metaMap['total'] as num?)?.toInt() ?? 0,
      totalPages: (metaMap['totalPages'] as num?)?.toInt() ?? 0,
    );
  }
}
