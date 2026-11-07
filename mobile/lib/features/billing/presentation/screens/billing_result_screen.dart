// /billing/result/:billingId — five states: approved, pending (polling up to
// 60 s), amount mismatch / needs review, fake/duplicate, rejected.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/feedback/app_snackbar.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../../core/widgets/layout/app_error_state.dart';
import '../../../profile/presentation/providers/profile_providers.dart';
import '../../data/models/billing_verification.dart';
import '../../data/models/package.dart';
import '../../domain/package_display.dart';
import '../providers/billing_provider.dart';
import '../widgets/billing_status_badge.dart';

class BillingResultScreen extends ConsumerStatefulWidget {
  const BillingResultScreen({
    super.key,
    required this.billingId,
    this.readOnly = false,
  });

  final String billingId;

  /// Opened from history: no "Start using your credits" flow action.
  final bool readOnly;

  @override
  ConsumerState<BillingResultScreen> createState() =>
      _BillingResultScreenState();
}

class _BillingResultScreenState extends ConsumerState<BillingResultScreen> {
  Timer? _timer;
  int _ticks = 0;
  bool _timedOut = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_ticks >= 59) {
        _timer?.cancel();
        setState(() => _timedOut = true);
        return;
      }
      _ticks++;
      ref.invalidate(billingDetailProvider(widget.billingId));
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final provider = billingDetailProvider(widget.billingId);
    final async = ref.watch(provider);
    final detail = async.valueOrNull;
    if (detail != null && !detail.status.isPending) {
      _timer?.cancel();
    }

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.billingResultDetailsTitle)),
      body: SafeArea(
        child: async.when(
          skipLoadingOnRefresh: true,
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: Padding(
              padding: AppSpacing.screenH,
              child: AppErrorState(
                message: error is ApiError
                    ? error.userFacingMessage(l10n)
                    : l10n.genericError,
                compact: true,
                onRetry: () => ref.invalidate(provider),
                retryLabel: l10n.retryLabel,
              ),
            ),
          ),
          data: (value) => value == null
              ? Center(
                  child: Text(
                    l10n.genericError,
                    style: AppTypography.bodyMedium.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                )
              : _ResultBody(
                  detail: value,
                  readOnly: widget.readOnly,
                  timedOut: _timedOut,
                ),
        ),
      ),
    );
  }
}

class _ResultBody extends ConsumerWidget {
  const _ResultBody({
    required this.detail,
    required this.readOnly,
    required this.timedOut,
  });

  final BillingVerification detail;
  final bool readOnly;
  final bool timedOut;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final status = detail.status;
    final packages = ref.watch(packagesProvider).valueOrNull ?? const <Package>[];
    final subscription = ref.watch(subscriptionMeProvider).valueOrNull;

    Package? package;
    for (final p in packages) {
      if (p.code == detail.packageCode) {
        package = p;
        break;
      }
    }
    final packageName = package?.name ?? packageNameFor(detail.packageCode);

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.xl,
        AppSpacing.lg,
        AppSpacing.xxxl,
      ),
      children: [
        _Hero(
          icon: switch (status) {
            BillingStatus.approved => Icons.check_circle_outline_rounded,
            BillingStatus.pending => Icons.hourglass_empty_rounded,
            BillingStatus.mismatch ||
            BillingStatus.needsReview =>
              Icons.schedule_outlined,
            _ => Icons.cancel_outlined,
          },
          accent: statusColor(colors, status),
          title: switch (status) {
            BillingStatus.approved => l10n.billingResultApprovedTitle,
            BillingStatus.pending => l10n.billingResultPendingTitle,
            BillingStatus.mismatch ||
            BillingStatus.needsReview =>
              l10n.billingResultReviewTitle,
            _ => l10n.billingResultRejectedTitle,
          },
          subtitle: switch (status) {
            BillingStatus.approved => l10n.billingResultActivated(packageName),
            BillingStatus.pending => l10n.billingResultPendingBody,
            BillingStatus.mismatch ||
            BillingStatus.needsReview =>
              l10n.billingResultReviewBody,
            BillingStatus.duplicate => l10n.billingResultDuplicateBody,
            _ => l10n.billingResultRejectedBody,
          },
        ),
        if (status.isApproved) ...[
          const SizedBox(height: AppSpacing.md),
          Center(child: BillingStatusBadge(status: status)),
          if (subscription?.expiresAt != null) ...[
            const SizedBox(height: AppSpacing.md),
            Center(
              child: Text(
                l10n.billingResultActiveUntil(
                  DateFormat('d MMM yyyy').format(subscription!.expiresAt!),
                ),
                style: AppTypography.bodySmall.copyWith(
                  color: colors.textSecondary,
                ),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Center(
            child: Text(
              package == null
                  ? l10n.billingResultCreditsAdded(0)
                  : package.unlimited
                      ? l10n.planUnlimitedVerifications
                      : l10n.billingResultCreditsAdded(
                          package.creditsPerMonth ?? 0,
                        ),
              style: AppTypography.bodyMedium.copyWith(
                color: colors.success,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
        if (status.isPending && timedOut) ...[
          const SizedBox(height: AppSpacing.lg),
          Text(
            l10n.billingResultTimeout,
            style: AppTypography.bodySmall.copyWith(color: colors.warning),
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        _DetailsCard(detail: detail),
        const SizedBox(height: AppSpacing.xxl),
        ..._actions(context, l10n, status),
      ],
    );
  }

  List<Widget> _actions(
    BuildContext context,
    AppLocalizations l10n,
    BillingStatus status,
  ) {
    void history() => context.push(Routes.billingHistory);

    switch (status) {
      case BillingStatus.approved:
        return [
          if (!readOnly)
            AppButton(
              label: l10n.billingResultStartUsing,
              onPressed: () => context.go(Routes.dashboard),
            )
          else
            AppButton(
              label: l10n.billingViewHistory,
              variant: AppButtonVariant.secondary,
              onPressed: history,
            ),
        ];
      case BillingStatus.pending:
        return [
          AppButton(
            label: l10n.billingResultCheckHistory,
            variant: AppButtonVariant.secondary,
            onPressed: history,
          ),
        ];
      case BillingStatus.mismatch:
      case BillingStatus.needsReview:
        return [
          AppButton(
            label: l10n.billingViewHistory,
            variant: AppButtonVariant.secondary,
            onPressed: history,
          ),
        ];
      case BillingStatus.duplicate:
      case BillingStatus.fake:
      case BillingStatus.rejected:
        return [
          AppButton(
            label: l10n.billingTryAgain,
            onPressed: () => context.go(Routes.billing),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: l10n.billingContactSupport,
            variant: AppButtonVariant.ghost,
            onPressed: () => AppSnackbar.show(
              context,
              message: l10n.billingSupportSoon,
            ),
          ),
        ];
    }
  }
}

class _Hero extends StatelessWidget {
  const _Hero({
    required this.icon,
    required this.accent,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final Color accent;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Column(
      children: [
        Container(
          width: 84,
          height: 84,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: accent.withValues(alpha: 0.10),
            border: Border.all(color: accent.withValues(alpha: 0.24), width: 1.5),
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: 40, color: accent),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          title,
          style: AppTypography.headingSmall.copyWith(color: colors.textPrimary),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          subtitle,
          style: AppTypography.bodySmall.copyWith(color: colors.textSecondary),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _DetailsCard extends StatelessWidget {
  const _DetailsCard({required this.detail});

  final BillingVerification detail;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final created = detail.createdAt;
    final paidAt = detail.paidAt;

    return AppCard(
      child: Column(
        children: [
          _Row(
            label: l10n.billingExpectedAmount,
            value: formatEtbMinor(detail.expectedAmountValue),
          ),
          if (detail.submittedAmountValue != null)
            _Row(
              label: l10n.billingSubmittedAmount,
              value: formatEtbMinor(detail.submittedAmountValue!),
            ),
          if ((detail.bankReference ?? '').isNotEmpty)
            _Row(
              label: l10n.billingReference,
              value: detail.bankReference!,
            ),
          _Row(
            label: l10n.billingSubmittedOn,
            value: DateFormat('d MMM yyyy, HH:mm').format(
              paidAt ?? created ?? DateTime.now(),
            ),
          ),
          if ((detail.reviewNote ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                detail.reviewNote!,
                style: AppTypography.bodySmall.copyWith(
                  color: colors.textSecondary,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style:
                  AppTypography.bodySmall.copyWith(color: colors.textSecondary),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Flexible(
            child: Text(
              value,
              style: AppTypography.bodySmall.copyWith(
                color: colors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}
