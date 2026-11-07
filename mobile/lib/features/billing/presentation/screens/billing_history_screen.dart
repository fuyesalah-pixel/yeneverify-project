// /billing/history — every billing attempt, newest first.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../../core/widgets/layout/app_empty_state.dart';
import '../../../../core/widgets/layout/app_error_state.dart';
import '../../../../core/widgets/layout/app_list_tile.dart';
import '../../data/models/billing_verification.dart';
import '../../domain/package_display.dart';
import '../providers/billing_provider.dart';
import '../widgets/billing_status_badge.dart';

class BillingHistoryScreen extends ConsumerWidget {
  const BillingHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final async = ref.watch(billingHistoryProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.billingHistoryTitle)),
      body: async.when(
        skipLoadingOnRefresh: true,
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => AppErrorState(
          message: error is ApiError
              ? error.userFacingMessage(l10n)
              : l10n.genericError,
          onRetry: () => ref.invalidate(billingHistoryProvider),
          retryLabel: l10n.retryLabel,
        ),
        data: (items) => items.isEmpty
            ? AppEmptyState(
                icon: Icons.receipt_long_outlined,
                title: l10n.billingNoHistory,
                body: l10n.billingNoHistoryBody,
              )
            : RefreshIndicator(
                color: colors.primaryAction,
                onRefresh: () => ref.refresh(billingHistoryProvider.future),
                child: ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.xxxl,
                  ),
                  itemCount: items.length,
                  separatorBuilder: (_, __) =>
                      const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (_, index) =>
                      _HistoryRow(item: items[index]),
                ),
              ),
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.item});

  final BillingSummary item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final created = item.createdAt;
    final subtitle = [
      formatEtbMinor(item.expectedAmountValue),
      if (created != null) DateFormat('d MMM yyyy').format(created),
    ].join(' · ');

    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      onTap: () => context.push(
        Routes.billingResultFor(item.id),
        extra: true,
      ),
      child: Material(
        color: Colors.transparent,
        child: AppListTile(
          leading: Icon(
            Icons.receipt_long_outlined,
            color: colors.textSecondary,
          ),
          title: packageNameFor(item.packageCode),
          subtitle: subtitle,
          trailing: BillingStatusBadge(status: item.status),
        ),
      ),
    );
  }
}
