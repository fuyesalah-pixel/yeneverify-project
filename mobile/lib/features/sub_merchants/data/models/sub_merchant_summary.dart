// GET /sub-merchants — one team row or pending invite.
//
// The backend models a pending invite as a SubMerchant row with
// status INVITED (kind is always SUB_MERCHANT), so `isInvite` is derived
// from status. The parser also accepts a kind INVITE for forward
// compatibility with the DTO shape.
class SubMerchantSummary {
  const SubMerchantSummary({
    required this.id,
    required this.status,
    required this.name,
    required this.phone,
    this.kind = SubMerchantKind.member,
    this.branchLabel,
    this.invitedAt,
    this.joinedAt,
  });

  final String id;
  final SubMerchantKind kind;
  final SubMerchantStatus status;
  final String name;

  /// Already masked server-side (+251*****44).
  final String phone;
  final String? branchLabel;
  final DateTime? invitedAt;
  final DateTime? joinedAt;

  bool get isInvite => kind == SubMerchantKind.invite || status == SubMerchantStatus.invited;

  bool get isActive => status == SubMerchantStatus.active;

  /// Avatar initials; falls back to the phone tail when there is no name.
  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) {
      return phone.length >= 2 ? phone.substring(phone.length - 2) : '?';
    }
    if (parts.length == 1) return parts.first.characters1();
    return '${parts.first.characters1()}${parts.last.characters1()}';
  }

  factory SubMerchantSummary.fromJson(Map<String, dynamic> json) {
    return SubMerchantSummary(
      id: (json['id'] as String?) ?? '',
      kind: (json['kind'] as String?) == 'INVITE'
          ? SubMerchantKind.invite
          : SubMerchantKind.member,
      status: SubMerchantStatus.fromWire(json['status'] as String?),
      name: (json['name'] as String?) ?? '',
      phone: (json['phone'] as String?) ?? '',
      branchLabel: json['branchLabel'] as String?,
      invitedAt: DateTime.tryParse(json['invitedAt'] as String? ?? ''),
      joinedAt: DateTime.tryParse(json['joinedAt'] as String? ?? ''),
    );
  }
}

class SubMerchantPage {
  const SubMerchantPage({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  final List<SubMerchantSummary> items;
  final int page;
  final int pageSize;
  final int total;

  factory SubMerchantPage.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] ?? json['data'];
    final meta = json['meta'];
    final metaMap = meta is Map ? meta : const {};
    return SubMerchantPage(
      items: rawItems is List
          ? rawItems
              .whereType<Map>()
              .map((e) => SubMerchantSummary.fromJson(Map<String, dynamic>.from(e)))
              .toList(growable: false)
          : const [],
      page: (json['page'] as num?)?.toInt() ??
          (metaMap['page'] as num?)?.toInt() ??
          1,
      pageSize: (json['pageSize'] as num?)?.toInt() ??
          (metaMap['pageSize'] as num?)?.toInt() ??
          0,
      total: (json['total'] as num?)?.toInt() ??
          (metaMap['total'] as num?)?.toInt() ??
          0,
    );
  }
}

enum SubMerchantKind { member, invite }

enum SubMerchantStatus {
  invited,
  active,
  suspended,
  removed,
  unknown;

  static SubMerchantStatus fromWire(String? value) {
    return switch ((value ?? '').toUpperCase()) {
      'INVITED' || 'PENDING' => SubMerchantStatus.invited,
      'ACTIVE' || 'ACCEPTED' => SubMerchantStatus.active,
      'SUSPENDED' => SubMerchantStatus.suspended,
      'REMOVED' || 'REVOKED' || 'DECLINED' || 'EXPIRED' => SubMerchantStatus.removed,
      _ => SubMerchantStatus.unknown,
    };
  }
}

extension on String {
  /// First character, uppercased, without pulling in `characters`.
  String characters1() => isEmpty ? '' : this[0].toUpperCase();
}
