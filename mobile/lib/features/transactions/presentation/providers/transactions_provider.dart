// Paginated transactions list.
//
// The query lives in its own provider so changing a filter invalidates the
// list exactly once; load-more keeps the existing rows and is the only path
// that appends.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/network/api_result.dart';
import '../../../verify/data/models/verification_result.dart';
import '../../../verify/data/models/verification_summary.dart';
import '../../../verify/data/verify_repository.dart';
import '../../domain/transactions_query.dart';

final transactionsQueryProvider = StateProvider<TransactionsQuery>(
  (ref) => const TransactionsQuery(),
);

class TransactionsState {
  const TransactionsState({
    required this.items,
    required this.page,
    required this.hasMore,
    required this.query,
    this.isLoadingMore = false,
    this.loadMoreError,
  });

  final List<VerificationSummary> items;
  final int page;
  final bool hasMore;
  final TransactionsQuery query;
  final bool isLoadingMore;
  final ApiError? loadMoreError;

  bool get isEmpty => items.isEmpty;

  TransactionsState copyWith({
    List<VerificationSummary>? items,
    int? page,
    bool? hasMore,
    bool? isLoadingMore,
    ApiError? loadMoreError,
    bool clearLoadMoreError = false,
  }) {
    return TransactionsState(
      items: items ?? this.items,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      query: query,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      loadMoreError: clearLoadMoreError ? null : (loadMoreError ?? this.loadMoreError),
    );
  }
}

class TransactionsNotifier extends AsyncNotifier<TransactionsState> {
  static const int pageSize = 20;

  @override
  Future<TransactionsState> build() async {
    final query = ref.watch(transactionsQueryProvider);
    final page = await _fetch(query, 1);
    return TransactionsState(
      items: page.items,
      page: 1,
      hasMore: page.totalPages > 1,
      query: query,
    );
  }

  /// Appends the next page. Keeps existing rows on failure and stops
  /// paginating rather than retrying forever behind the user's back.
  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null ||
        !current.hasMore ||
        current.isLoadingMore ||
        current.loadMoreError != null) {
      return;
    }

    state = AsyncData(current.copyWith(isLoadingMore: true, clearLoadMoreError: true));

    final result = await ref.read(verificationsApiProvider).list(
          page: current.page + 1,
          pageSize: pageSize,
          status: current.query.statusCsv,
          bankCode: current.query.bankCsv,
          from: current.query.range.from(DateTime.now()),
          to: current.query.range == TransactionsRange.all ? null : DateTime.now(),
          search: current.query.search,
          sortBy: current.query.sortBy,
          sortOrder: current.query.sortOrder,
        );

    final latest = state.valueOrNull ?? current;
    switch (result) {
      case Success(:final data):
        state = AsyncData(
          latest.copyWith(
            items: [...latest.items, ...data.items],
            page: current.page + 1,
            hasMore: current.page + 1 < data.totalPages,
            isLoadingMore: false,
          ),
        );
      case Failure(:final error):
        state = AsyncData(
          latest.copyWith(
            isLoadingMore: false,
            hasMore: false,
            loadMoreError: error,
          ),
        );
    }
  }

  /// Pull-to-refresh: refetch page 1 with the current query.
  Future<void> refresh() async {
    ref.invalidateSelf();
    await ref.read(transactionsProvider.future);
  }

  void updateQuery(TransactionsQuery next) {
    ref.read(transactionsQueryProvider.notifier).state = next;
  }

  void toggleStatus(VerificationStatus status) {
    final query = ref.read(transactionsQueryProvider);
    final next = {...query.statuses};
    if (!next.remove(status)) next.add(status);
    updateQuery(query.copyWith(statuses: next));
  }

  void clearFilters() {
    updateQuery(const TransactionsQuery());
  }

  Future<VerificationPage> _fetch(TransactionsQuery query, int page) async {
    final now = DateTime.now();
    final result = await ref.read(verificationsApiProvider).list(
          page: page,
          pageSize: pageSize,
          status: query.statusCsv,
          bankCode: query.bankCsv,
          from: query.range.from(now),
          to: query.range == TransactionsRange.all ? null : now,
          search: query.search,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        );
    return switch (result) {
      Success(:final data) => data,
      Failure(:final error) => throw error,
    };
  }
}

final transactionsProvider =
    AsyncNotifierProvider<TransactionsNotifier, TransactionsState>(
  TransactionsNotifier.new,
);
