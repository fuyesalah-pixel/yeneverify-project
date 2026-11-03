// GET /analytics/trend — current vs previous range, with percentage deltas.
//
// Deltas are null when the previous range had no data (division by zero is
// not a percentage), so the chip must be able to say "—".
class AnalyticsTrend {
  const AnalyticsTrend({
    required this.currentCount,
    required this.currentAmountMinor,
    required this.previousCount,
    required this.previousAmountMinor,
    required this.direction,
    this.countPct,
    this.amountPct,
  });

  final int currentCount;
  final String currentAmountMinor;
  final int previousCount;
  final String previousAmountMinor;
  final String direction; // 'up' | 'down' | 'flat'
  final double? countPct;
  final double? amountPct;

  int get currentAmountValue => int.tryParse(currentAmountMinor) ?? 0;

  factory AnalyticsTrend.fromJson(Map<String, dynamic> json) {
    final current = json['current'];
    final previous = json['previous'];
    final delta = json['delta'];
    final currentMap = current is Map ? current : const {};
    final previousMap = previous is Map ? previous : const {};
    final deltaMap = delta is Map ? delta : const {};

    double? pct(Object? value) => value is num ? value.toDouble() : null;

    return AnalyticsTrend(
      currentCount: (currentMap['count'] as num?)?.toInt() ?? 0,
      currentAmountMinor: '${currentMap['amountMinor'] ?? '0'}',
      previousCount: (previousMap['count'] as num?)?.toInt() ?? 0,
      previousAmountMinor: '${previousMap['amountMinor'] ?? '0'}',
      direction: (json['direction'] as String?) ?? 'flat',
      countPct: pct(deltaMap['countPct']),
      amountPct: pct(deltaMap['amountPct']),
    );
  }
}
