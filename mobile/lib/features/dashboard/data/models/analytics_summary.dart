// GET /analytics/summary — totals for the selected range.
//
// Money is a string because the backend serialises bigint minor units as
// strings; parse only where a number is needed.
class AnalyticsSummary {
  const AnalyticsSummary({
    required this.days,
    required this.count,
    required this.amountMinor,
    required this.avgAmountMinor,
    required this.uniqueSenders,
    required this.uniqueSubMerchants,
    this.from,
    this.to,
  });

  final int days;
  final int count;
  final String amountMinor;
  final String avgAmountMinor;
  final int uniqueSenders;
  final int uniqueSubMerchants;
  final DateTime? from;
  final DateTime? to;

  int get amountValue => int.tryParse(amountMinor) ?? 0;

  factory AnalyticsSummary.fromJson(Map<String, dynamic> json) {
    final range = json['range'];
    final totals = json['totals'];
    final totalsMap = totals is Map ? totals : const {};
    return AnalyticsSummary(
      days: range is Map ? ((range['days'] as num?)?.toInt() ?? 30) : 30,
      from: range is Map
          ? DateTime.tryParse(range['from'] as String? ?? '')
          : null,
      to: range is Map ? DateTime.tryParse(range['to'] as String? ?? '') : null,
      count: (totalsMap['count'] as num?)?.toInt() ?? 0,
      amountMinor: '${totalsMap['amountMinor'] ?? '0'}',
      avgAmountMinor: '${totalsMap['avgAmountMinor'] ?? '0'}',
      uniqueSenders: (totalsMap['uniqueSenders'] as num?)?.toInt() ?? 0,
      uniqueSubMerchants:
          (totalsMap['uniqueSubMerchants'] as num?)?.toInt() ?? 0,
    );
  }
}
