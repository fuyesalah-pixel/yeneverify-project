import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/transactions/domain/transactions_query.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';

void main() {
  final now = DateTime.utc(2026, 11, 3, 12);

  test('the default query is "last 30 days, everything"', () {
    const query = TransactionsQuery();

    expect(query.isDefault, isTrue);
    expect(query.activeFilterCount, 0);
    expect(query.statusCsv, isNull);
    expect(query.bankCsv, isNull);
  });

  test('copyWith replaces one dimension and keeps the rest', () {
    const base = TransactionsQuery();
    final next = base.copyWith(
      statuses: {VerificationStatus.verified, VerificationStatus.fake},
      banks: {'CBE'},
    );

    expect(next.statuses.length, 2);
    expect(next.banks, {'CBE'});
    expect(next.range, TransactionsRange.d30);
    expect(base.statuses, isEmpty);
  });

  test('statusCsv serializes to the wire enum', () {
    const query = TransactionsQuery(
      statuses: {VerificationStatus.verified, VerificationStatus.needsReview},
    );

    expect(query.statusCsv, 'VERIFIED,NEEDS_REVIEW');
  });

  test('params include filters, search and a from/to pair', () {
    final params = const TransactionsQuery(
      statuses: {VerificationStatus.fake},
      banks: {'CBE', 'TELEBIRR'},
      range: TransactionsRange.d7,
      search: ' FT23 ',
    ).toApiParams(page: 2, pageSize: 20, now: now);

    expect(params['page'], 2);
    expect(params['pageSize'], 20);
    expect(params['status'], 'FAKE');
    expect(params['bankCode'], 'CBE,TELEBIRR');
    expect(params['search'], 'FT23');
    expect(params['from'], isNotNull);
    expect(params['to'], isNotNull);
  });

  test('"all time" sends no date bounds at all', () {
    final params = const TransactionsQuery(range: TransactionsRange.all)
        .toApiParams(page: 1, pageSize: 20, now: now);

    expect(params.containsKey('from'), isFalse);
    expect(params.containsKey('to'), isFalse);
    expect(params.containsKey('status'), isFalse);
  });

  test('clearSearch drops the term', () {
    const query = TransactionsQuery(search: 'FT');
    expect(query.copyWith(clearSearch: true).search, isNull);
  });

  test('activeFilterCount counts status, bank and a non-default range', () {
    const query = TransactionsQuery(
      statuses: {VerificationStatus.verified},
      banks: {'CBE'},
      range: TransactionsRange.d90,
    );

    expect(query.activeFilterCount, 3);
    expect(query.isDefault, isFalse);
  });
}
