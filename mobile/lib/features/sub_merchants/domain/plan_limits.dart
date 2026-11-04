// Team-seat caps per package. Mirrors packages.max_sub_merchants on the
// backend (FREE=1, PREMIUM=1, BUSINESS=10, BUSINESS_PRO=unlimited) so the
// list can warn before the API returns PLAN_LIMIT_SUB_MERCHANTS.
int? subMerchantLimitFor(String? packageCode) {
  return switch ((packageCode ?? '').toUpperCase()) {
    'FREE' => 1,
    'PREMIUM' => 1,
    'BUSINESS' => 10,
    'BUSINESS_PRO' || 'API' => null,
    _ => null,
  };
}

/// Seat usage for the merchant's current plan.
class PlanCap {
  const PlanCap({required this.packageCode, required this.used});

  final String packageCode;
  final int used;

  /// null means unlimited.
  int? get limit => subMerchantLimitFor(packageCode);

  bool get capped => limit != null;

  /// True at the cap: the next invite will be rejected with
  /// PLAN_LIMIT_SUB_MERCHANTS.
  bool get atLimit => limit != null && used >= limit!;

  bool get canInvite => !atLimit;

  int get remaining {
    final max = limit;
    if (max == null) return 0;
    final left = max - used;
    return left < 0 ? 0 : left;
  }
}

/// Local masking for phone numbers the client typed itself (the API masks
/// every phone it returns). +251922333444 → +251*****44.
String maskEthiopianPhone(String phone) {
  if (RegExp(r'^\+251\d{9}$').hasMatch(phone)) {
    return '+251*****${phone.substring(phone.length - 2)}';
  }
  return phone;
}

/// Accepts +2519XXXXXXXX, 2519XXXXXXXX or 09XXXXXXXX and returns the
/// E.164 form the invite endpoint requires. Null when the number is not a
/// valid Ethiopian mobile.
String? normalizeEthiopianPhone(String raw) {
  final cleaned = raw.replaceAll(RegExp(r'[\s\-()]'), '');
  if (RegExp(r'^\+2519\d{8}$').hasMatch(cleaned)) return cleaned;
  if (RegExp(r'^2519\d{8}$').hasMatch(cleaned)) return '+$cleaned';
  if (RegExp(r'^09\d{8}$').hasMatch(cleaned)) {
    return '+251${cleaned.substring(1)}';
  }
  return null;
}
