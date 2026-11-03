// Step 23B — the history tab: browse, filter, search, paginate.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/layout/app_empty_state.dart';
import '../../../../core/widgets/layout/app_error_state.dart';
import '../../../../core/widgets/layout/app_loading_skeleton.dart';
import '../providers/transactions_provider.dart';
import '../widgets/filter_chips_row.dart';
import '../widgets/filters_sheet.dart';
import '../widgets/transaction_row_compact.dart';

class TransactionsScreen extends ConsumerStatefulWidget {
  const TransactionsScreen({super.key});

  @override
  ConsumerState<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends ConsumerState<TransactionsScreen> {
  final _scroll = ScrollController();
  final _searchController = TextEditingController();
  Timer? _debounce;
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final position = _scroll.position;
    if (position.pixels >= position.maxScrollExtent * 0.8) {
      ref.read(transactionsProvider.notifier).loadMore();
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      final query = ref.read(transactionsQueryProvider);
      ref.read(transactionsProvider.notifier).updateQuery(
            value.trim().isEmpty
                ? query.copyWith(clearSearch: true)
                : query.copyWith(search: value),
          );
    });
  }

  void _toggleSearch() {
    setState(() {
      _searching = !_searching;
      if (!_searching) {
        _searchController.clear();
        _debounce?.cancel();
        final query = ref.read(transactionsQueryProvider);
        ref.read(transactionsProvider.notifier).updateQuery(query.copyWith(clearSearch: true));
      }
    });
  }

  Future<void> _openFilters() async {
    final query = ref.read(transactionsQueryProvider);
    final result = await FiltersSheet.show(
      context,
      banks: query.banks,
      range: query.range,
    );
    if (result == null) return;
    ref.read(transactionsProvider.notifier).updateQuery(
          query.copyWith(banks: result.banks, range: result.range),
        );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final query = ref.watch(transactionsQueryProvider);
    final async = ref.watch(transactionsProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: _searching
            ? TextField(
                controller: _searchController,
                autofocus: true,
                onChanged: _onSearchChanged,
                style: AppTypography.bodyMedium.copyWith(color: colors.textPrimary),
                decoration: InputDecoration(
                  border: InputBorder.none,
                  hintText: l10n.transactionsSearchHint,
                  hintStyle: AppTypography.bodyMedium.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              )
            : Text(l10n.transactionsTitle),
        actions: [
          IconButton(
            tooltip: l10n.transactionsSearchHint,
            icon: Icon(_searching ? Icons.close_rounded : Icons.search_rounded),
            onPressed: _toggleSearch,
          ),
          if (!_searching)
            IconButton(
              tooltip: l10n.transactionsFilterTitle,
              icon: Badge(
                isLabelVisible: query.activeFilterCount > 0,
                label: Text('${query.activeFilterCount}'),
                backgroundColor: colors.primaryAction,
                textColor: colors.onPrimary,
                child: const Icon(Icons.tune_rounded),
              ),
              onPressed: _openFilters,
            ),
        ],
      ),
      body: Column(
        children: [
          const SizedBox(height: AppSpacing.sm),
          FilterChipsRow(
            selected: query.statuses,
            onToggle: (status) =>
                ref.read(transactionsProvider.notifier).toggleStatus(status),
            onClear: () => ref.read(transactionsProvider.notifier).clearFilters(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Expanded(
            child: async.when(
              skipLoadingOnRefresh: true,
              loading: () => const TransactionListSkeleton(),
              error: (error, _) => AppErrorState(
                message: error is ApiError
                    ? error.userFacingMessage(l10n)
                    : l10n.dashboardErrorBody,
                onRetry: () => ref.invalidate(transactionsProvider),
                retryLabel: l10n.retryLabel,
              ),
              data: (state) => RefreshIndicator(
                color: colors.primaryAction,
                onRefresh: () async {
                  try {
                    await ref.read(transactionsProvider.notifier).refresh();
                  } catch (_) {
                    // The error state renders from the provider.
                  }
                },
                child: state.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          AppEmptyState(
                            compact: true,
                            icon: Icons.receipt_long_outlined,
                            title: l10n.transactionsEmptyTitle,
                            body: l10n.transactionsEmptyBody,
                            actionLabel: query.isDefault
                                ? null
                                : l10n.transactionsEmptyAction,
                            onAction: query.isDefault
                                ? null
                                : () => ref
                                    .read(transactionsProvider.notifier)
                                    .clearFilters(),
                          ),
                        ],
                      )
                    : ListView.builder(
                        controller: _scroll,
                        physics: const AlwaysScrollableScrollPhysics(),
                        itemCount: state.items.length + 1,
                        itemBuilder: (context, index) {
                          if (index == state.items.length) {
                            return _ListFooter(state: state);
                          }
                          final item = state.items[index];
                          return Column(
                            children: [
                              TransactionRowCompact(
                                item: item,
                                onTap: () => context.push(
                                  Routes.transactionFor(item.id),
                                ),
                              ),
                              if (index < state.items.length - 1)
                                Divider(
                                  height: 1,
                                  thickness: 1,
                                  indent: AppSpacing.lg,
                                  endIndent: AppSpacing.lg,
                                  color: colors.divider,
                                ),
                            ],
                          );
                        },
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ListFooter extends ConsumerWidget {
  const _ListFooter({required this.state});

  final TransactionsState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    if (state.isLoadingMore) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: colors.primaryAction,
            ),
          ),
        ),
      );
    }

    if (state.loadMoreError != null) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Center(
          child: TextButton(
            onPressed: () {
              // Retry resets the error flag, then asks for the next page.
              ref.read(transactionsProvider.notifier).loadMore();
            },
            child: Text(l10n.transactionsLoadMoreError),
          ),
        ),
      );
    }

    if (!state.hasMore) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Center(
          child: Text(
            l10n.transactionsNoMore,
            style: AppTypography.bodySmall.copyWith(color: colors.textDisabled),
          ),
        ),
      );
    }

    return const SizedBox(height: AppSpacing.xxl);
  }
}
