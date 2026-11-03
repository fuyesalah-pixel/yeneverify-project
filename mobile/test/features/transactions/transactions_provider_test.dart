import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/features/transactions/domain/transactions_query.dart';
import 'package:yene_verify/features/transactions/presentation/providers/transactions_provider.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/data/models/verification_summary.dart';
import 'package:yene_verify/features/verify/data/verifications_api.dart';
import 'package:yene_verify/features/verify/data/verify_repository.dart';

VerificationSummary row(String id) => VerificationSummary(
      id: id,
      status: VerificationStatus.verified,
      bankCode: 'CBE',
      bankReference: 'FT$id',
      amountMinor: '550000',
      createdAt: DateTime(2026, 11, 1),
    );

VerificationPage page(List<String> ids, {required int page, required int totalPages}) {
  return VerificationPage(
    items: ids.map(row).toList(),
    page: page,
    pageSize: 20,
    total: totalPages * 20,
    totalPages: totalPages,
  );
}

class FakeListApi extends VerificationsApi {
  FakeListApi(this.pages) : super(Dio());

  final Map<int, ApiResult<VerificationPage>> pages;
  final List<Map<String, dynamic>> calls = [];

  @override
  Future<ApiResult<VerificationPage>> list({
    int page = 1,
    int pageSize = 20,
    String? status,
    String? bankCode,
    DateTime? from,
    DateTime? to,
    String? search,
    String sortBy = 'createdAt',
    String sortOrder = 'desc',
  }) async {
    calls.add({
      'page': page,
      'status': status,
      'bankCode': bankCode,
      'search': search,
      'from': from,
    });
    return pages[page] ??
        const Failure(ApiError(code: 'VALIDATION_FAILED', httpStatus: 400));
  }
}

ProviderContainer containerFor(FakeListApi api) {
  final container = ProviderContainer(
    overrides: [verificationsApiProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('page 1 exposes hasMore when the backend has a second page', () async {
    final api = FakeListApi({1: Success(page(['a', 'b'], page: 1, totalPages: 2))});
    final container = containerFor(api);

    final state = await container.read(transactionsProvider.future);

    expect(state.items.map((e) => e.id), ['a', 'b']);
    expect(state.page, 1);
    expect(state.hasMore, isTrue);
  });

  test('loadMore appends the next page and stops at the end', () async {
    final api = FakeListApi({
      1: Success(page(['a', 'b'], page: 1, totalPages: 2)),
      2: Success(page(['c', 'd'], page: 2, totalPages: 2)),
    });
    final container = containerFor(api);
    await container.read(transactionsProvider.future);

    await container.read(transactionsProvider.notifier).loadMore();
    final state = container.read(transactionsProvider).valueOrNull!;

    expect(state.items.map((e) => e.id), ['a', 'b', 'c', 'd']);
    expect(state.page, 2);
    expect(state.hasMore, isFalse);
    expect(state.isLoadingMore, isFalse);
  });

  test('a failed loadMore keeps the rows and stops paginating', () async {
    final api = FakeListApi({1: Success(page(['a', 'b'], page: 1, totalPages: 2))});
    final container = containerFor(api);
    await container.read(transactionsProvider.future);

    await container.read(transactionsProvider.notifier).loadMore();
    final state = container.read(transactionsProvider).valueOrNull!;

    expect(state.items.length, 2);
    expect(state.loadMoreError, isNotNull);
    expect(state.hasMore, isFalse);
  });

  test('a status filter reaches the API as CSV and resets to page 1', () async {
    final api = FakeListApi({1: Success(page(['a'], page: 1, totalPages: 1))});
    final container = containerFor(api);
    await container.read(transactionsProvider.future);

    container.read(transactionsProvider.notifier).toggleStatus(
          VerificationStatus.fake,
        );
    await container.read(transactionsProvider.future);

    expect(api.calls.last['status'], 'FAKE');
    expect(api.calls.last['page'], 1);
  });

  test('clearing filters returns to the default query', () async {
    final api = FakeListApi({1: Success(page(['a'], page: 1, totalPages: 1))});
    final container = containerFor(api);
    await container.read(transactionsProvider.future);

    final notifier = container.read(transactionsProvider.notifier);
    notifier.updateQuery(const TransactionsQuery(
      statuses: {VerificationStatus.verified},
      range: TransactionsRange.all,
      search: 'FT',
    ));
    await container.read(transactionsProvider.future);
    notifier.clearFilters();

    expect(container.read(transactionsQueryProvider).isDefault, isTrue);
  });
}
