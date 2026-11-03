// Filter state for the transactions list.
//
// Pure and immutable so the wire params can be unit-tested without a widget
// or a network call. `null` always means "no filter"; an empty set means the
// same but survives copyWith semantics better.
import '../../verify/data/models/verification_result.dart';

/// Date presets. "This year" and "all time" exist because the seed data is
/// older than 30 days and a merchant still needs a way to reach it.
enum TransactionsRange { d7, d30, d90, thisYear, all }

extension TransactionsRangeX on TransactionsRange {
  DateTime? from(DateTime now) => switch (this) {
        TransactionsRange.d7 => now.subtract(const Duration(days: 7)),
        TransactionsRange.d30 => now.subtract(const Duration(days: 30)),
        TransactionsRange.d90 => now.subtract(const Duration(days: 90)),
        TransactionsRange.thisYear => DateTime(now.year),
        TransactionsRange.all => null,
      };
}

class TransactionsQuery {
  const TransactionsQuery({
    this.statuses = const {},
    this.banks = const {},
    this.range = TransactionsRange.d30,
    this.search,
    this.sortBy = 'createdAt',
    this.sortOrder = 'desc',
  });

  final Set<VerificationStatus> statuses;
  final Set<String> banks;
  final TransactionsRange range;
  final String? search;
  final String sortBy;
  final String sortOrder;

  bool get hasSearch => search != null && search!.trim().isNotEmpty;

  bool get isDefault =>
      statuses.isEmpty && banks.isEmpty && range == TransactionsRange.d30 && !hasSearch;

  int get activeFilterCount =>
      (statuses.isEmpty ? 0 : 1) +
      (banks.isEmpty ? 0 : 1) +
      (range == TransactionsRange.d30 ? 0 : 1);

  TransactionsQuery copyWith({
    Set<VerificationStatus>? statuses,
    Set<String>? banks,
    TransactionsRange? range,
    String? search,
    bool clearSearch = false,
  }) {
    return TransactionsQuery(
      statuses: statuses ?? this.statuses,
      banks: banks ?? this.banks,
      range: range ?? this.range,
      search: clearSearch ? null : (search ?? this.search),
      sortBy: sortBy,
      sortOrder: sortOrder,
    );
  }

  /// The backend takes CSV for both multi-selects.
  String? get statusCsv =>
      statuses.isEmpty ? null : statuses.map((s) => s.wire).join(',');

  String? get bankCsv => banks.isEmpty ? null : banks.join(',');

  /// Query map for GET /verifications. `now` is injectable for tests.
  Map<String, dynamic> toApiParams({
    required int page,
    required int pageSize,
    DateTime? now,
  }) {
    final current = now ?? DateTime.now();
    final from = range.from(current);
    return {
      'page': page,
      'pageSize': pageSize,
      if (statusCsv != null) 'status': statusCsv,
      if (bankCsv != null) 'bankCode': bankCsv,
      if (from != null) 'from': from.toUtc().toIso8601String(),
      if (from != null) 'to': current.toUtc().toIso8601String(),
      if (hasSearch) 'search': search!.trim(),
      'sortBy': sortBy,
      'sortOrder': sortOrder,
    };
  }
}
