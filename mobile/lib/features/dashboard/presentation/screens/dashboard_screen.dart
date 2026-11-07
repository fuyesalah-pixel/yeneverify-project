// Step 23A — the dashboard shell.
//
// One composite fetch (see dashboard_provider), pull-to-refresh, a quiet
// banner when a non-critical call failed, and a full error state only when
// the merchant profile itself is unavailable.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/feedback/app_snackbar.dart';
import '../../../../core/widgets/fintech/amount_text.dart';
import '../../../../core/widgets/fintech/stat_card.dart';
import '../../../../core/widgets/fintech/trend_chip.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../../core/widgets/layout/app_empty_state.dart';
import '../../../../core/widgets/layout/app_error_state.dart';
import '../../../auth/domain/auth_notifier.dart';
import '../../data/models/analytics_trend.dart';
import '../providers/dashboard_provider.dart';
import '../widgets/dashboard_header.dart';
import '../widgets/dashboard_skeleton.dart';
import '../widgets/quick_actions_section.dart';
import '../widgets/recent_activity_section.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final data = ref.watch(dashboardProvider);

    return Scaffold(
      backgroundColor: colors.background,
      body: data.when(
        skipLoadingOnRefresh: true,
        loading: () => const DashboardSkeleton(),
        error: (error, _) => SafeArea(
          child: AppErrorState(
            message: error is ApiError
                ? error.userFacingMessage(l10n)
                : l10n.dashboardErrorBody,
            onRetry: () => ref.invalidate(dashboardProvider),
            retryLabel: l10n.retryLabel,
          ),
        ),
        data: (value) => RefreshIndicator(
          color: colors.primaryAction,
          onRefresh: () => _refresh(ref),
          child: _DashboardBody(data: value),
        ),
      ),
    );
  }

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(dashboardProvider);
    ref.invalidate(unreadCountProvider);
    try {
      await ref.read(dashboardProvider.future);
    } catch (_) {
      // The error state is rendered from the provider; a failed pull is not
      // an unhandled exception.
    }
  }
}

class _DashboardBody extends ConsumerWidget {
  const _DashboardBody({required this.data});

  final DashboardData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final range = ref.watch(dashboardRangeProvider);

    return SafeArea(
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.xxxl,
        ),
        children: [
          DashboardHeader(
            greeting: _greeting(context, ref, l10n),
            unreadCount: data.unreadCount,
            notificationsTooltip: l10n.dashboardNotifications,
            onNotifications: () {
              // Step 26 owns the inbox; the bell is honest about it.
              AppSnackbar.show(
                context,
                message: l10n.dashboardInboxSoon,
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          if (data.partial) ...[
            _StaleBanner(
              message: l10n.dashboardStaleBanner,
              onTap: () => ref.read(dashboardProvider.notifier).refresh(),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          _HeroCard(data: data),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: StatCard(
                  label: l10n.dashboardThisMonth,
                  trend: TrendChip(
                    direction: _direction(data.trend),
                    percent: data.trend?.amountPct,
                  ),
                  value: data.summary == null
                      ? const Text('—', style: AppTypography.headingSmall)
                      : AmountText(
                          amountMinor: data.summary!.amountValue,
                          size: AmountTextSize.heading,
                        ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: StatCard(
                  label: l10n.dashboardVerifications,
                  trend: TrendChip(
                    direction: _direction(data.trend),
                    percent: data.trend?.countPct,
                  ),
                  value: Text(
                    data.summary == null ? '—' : '${data.summary!.count}',
                    style: AppTypography.headingSmall.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: Alignment.centerLeft,
            child: _RangeButton(
              label: _rangeLabel(l10n, range),
              onTap: () => _showRangeSheet(context, ref, range),
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          QuickActionsSection(
            verifyTitle: l10n.dashboardQuickVerifyTitle,
            verifyBody: l10n.dashboardQuickVerifyBody,
            transactionsTitle: l10n.dashboardQuickHistoryTitle,
            transactionsBody: l10n.dashboardQuickHistoryBody,
            onVerify: () => context.go(Routes.verify),
            onTransactions: () => context.go(Routes.history),
          ),
          const SizedBox(height: AppSpacing.xl),
          if (data.recent.isEmpty)
            AppEmptyState(
              compact: true,
              icon: Icons.receipt_long_outlined,
              title: l10n.dashboardEmptyTitle,
              body: l10n.dashboardEmptyBody,
              actionLabel: l10n.dashboardQuickVerifyTitle,
              onAction: () => context.go(Routes.verify),
            )
          else
            RecentActivitySection(
              items: data.recent,
              onSeeAll: () => context.go(Routes.history),
              onOpen: (item) => context.push(Routes.verdictFor(item.id)),
            ),
        ],
      ),
    );
  }

  String _greeting(BuildContext context, WidgetRef ref, AppLocalizations l10n) {
    final auth = ref.watch(authProvider).valueOrNull;
    final name = (auth?.user?.fullName ?? '').trim().split(' ').first;
    if (name.isEmpty) return l10n.dashboardWelcomeBack;
    final hour = DateTime.now().hour;
    if (hour < 12) return l10n.greetingMorning(name);
    if (hour < 18) return l10n.greetingAfternoon(name);
    return l10n.greetingEvening(name);
  }

  TrendDirection _direction(AnalyticsTrend? trend) {
    return switch (trend?.direction) {
      'up' => TrendDirection.up,
      'down' => TrendDirection.down,
      _ => TrendDirection.flat,
    };
  }

  String _rangeLabel(AppLocalizations l10n, DashboardRange range) {
    return switch (range) {
      DashboardRange.d7 => l10n.dashboardRange7,
      DashboardRange.d30 => l10n.dashboardRange30,
      DashboardRange.d90 => l10n.dashboardRange90,
      DashboardRange.d365 => l10n.dashboardRange365,
    };
  }

  Future<void> _showRangeSheet(
    BuildContext context,
    WidgetRef ref,
    DashboardRange current,
  ) async {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final selected = await showModalBottomSheet<DashboardRange>(
      context: context,
      backgroundColor: colors.surface,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final range in DashboardRange.values)
              ListTile(
                title: Text(_rangeLabel(l10n, range)),
                trailing: range == current
                    ? Icon(Icons.check_rounded, color: colors.primaryAction)
                    : null,
                onTap: () => Navigator.of(sheetContext).pop(range),
              ),
          ],
        ),
      ),
    );
    if (selected != null) {
      ref.read(dashboardRangeProvider.notifier).state = selected;
    }
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.data});

  final DashboardData data;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final businessName = data.merchant.businessName.trim();
    final packageCode = data.packageCode;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            businessName.isEmpty
                ? l10n.dashboardBusinessFallback
                : businessName,
            style: AppTypography.headingMedium.copyWith(
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Icon(
                Icons.bolt_rounded,
                size: 18,
                color: data.lowBalance ? colors.warning : colors.primaryAction,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  data.unlimited
                      ? l10n.dashboardUnlimited
                      : l10n.dashboardCreditsLeft(data.creditsValue),
                  style: AppTypography.bodyMedium.copyWith(
                    color:
                        data.lowBalance ? colors.warning : colors.textSecondary,
                  ),
                ),
              ),
              if (packageCode.isNotEmpty)
                _PlanChip(label: packageCode, accent: colors.primaryAction),
            ],
          ),
          if (data.lowBalance) ...[
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => context.push(Routes.billing),
                style: TextButton.styleFrom(
                  foregroundColor: colors.warning,
                  padding: EdgeInsets.zero,
                  visualDensity: VisualDensity.compact,
                ),
                child: Text(l10n.dashboardTopUp),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PlanChip extends StatelessWidget {
  const _PlanChip({required this.label, required this.accent});

  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.micro,
      ),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppSpacing.sm),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(color: accent),
      ),
    );
  }
}

class _RangeButton extends StatelessWidget {
  const _RangeButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return TextButton.icon(
      onPressed: onTap,
      icon: Icon(Icons.calendar_today_outlined,
          size: 16, color: colors.textSecondary),
      label: Text(label),
      style: TextButton.styleFrom(
        foregroundColor: colors.textSecondary,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}

class _StaleBanner extends StatelessWidget {
  const _StaleBanner({required this.message, required this.onTap});

  final String message;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppSpacing.md),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: colors.warning.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(AppSpacing.md),
        ),
        child: Row(
          children: [
            Icon(Icons.info_outline_rounded, size: 18, color: colors.warning),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: AppTypography.bodySmall.copyWith(
                  color: colors.textPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
