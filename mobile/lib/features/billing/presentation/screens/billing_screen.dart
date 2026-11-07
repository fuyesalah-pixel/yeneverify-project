// /billing — the catalog: current plan, upgradeable packages, history link.
//
// Choosing a plan opens the billing session first (POST /billing/initiate),
// then hands that session to the checkout route. The session stays cached in
// checkoutProvider, so the upload step never re-prices.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
import '../../../../core/widgets/layout/app_list_tile.dart';
import '../../../../core/widgets/layout/section_header.dart';
import '../../data/models/package.dart';
import '../../domain/package_display.dart';
import '../providers/billing_provider.dart';
import '../providers/checkout_provider.dart';
import '../widgets/current_subscription_card.dart';
import '../widgets/package_card.dart';

class BillingScreen extends ConsumerStatefulWidget {
  const BillingScreen({super.key});

  @override
  ConsumerState<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends ConsumerState<BillingScreen> {
  String? _busyCode;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final overview = ref.watch(billingOverviewProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.billingScreenTitle)),
      body: overview.when(
        skipLoadingOnRefresh: true,
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => AppErrorState(
          message: error is ApiError
              ? error.userFacingMessage(l10n)
              : l10n.genericError,
          onRetry: () => ref.invalidate(billingOverviewProvider),
          retryLabel: l10n.retryLabel,
        ),
        data: (value) => !value.isMerchant
            ? _OwnerOnly()
            : _Catalog(
                overview: value,
                busyCode: _busyCode,
                onChoose: _startCheckout,
              ),
      ),
    );
  }

  Future<void> _startCheckout(Package package) async {
    if (_busyCode != null) return;
    final l10n = AppLocalizations.of(context);
    setState(() => _busyCode = package.code);

    try {
      final state = await ref.read(checkoutProvider(package.code).future);
      if (!mounted) return;
      final session = state.session;
      if (session == null) {
        AppSnackbar.show(
          context,
          message: l10n.genericError,
          variant: AppSnackbarVariant.error,
        );
        return;
      }
      context.push(
        Routes.billingCheckoutFor(session.billingSessionId),
        extra: session,
      );
    } catch (e) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: e is ApiError ? e.userFacingMessage(l10n) : l10n.genericError,
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _busyCode = null);
    }
  }
}

class _Catalog extends StatelessWidget {
  const _Catalog({
    required this.overview,
    required this.busyCode,
    required this.onChoose,
  });

  final BillingOverview overview;
  final String? busyCode;
  final ValueChanged<Package> onChoose;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final currentCode = overview.currentPackageCode;
    final subscription = overview.subscription;
    final packages = visiblePackages(overview.packages, currentCode);

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.xxxl,
      ),
      children: [
        if (subscription != null && (currentCode ?? '').isNotEmpty) ...[
          CurrentSubscriptionCard(
            subscription: subscription,
            actionLabel: l10n.billingManage,
            isBusy: busyCode == currentCode,
            onManage: () => onChoose(
              overview.packages.firstWhere(
                (p) => p.code == currentCode,
                orElse: () => Package(
                  code: currentCode!,
                  name: subscription.packageName,
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
        ],
        SectionHeader(title: l10n.billingPlansSection),
        const SizedBox(height: AppSpacing.sm),
        for (final package in packages) ...[
          PackageCard(
            package: package,
            action: packageAction(package, currentCode),
            isBusy: busyCode == package.code,
            onAction: () => onChoose(package),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (packages.isEmpty)
          Text(
            l10n.billingNoPlans,
            style: AppTypography.bodyMedium.copyWith(
              color: colors.textSecondary,
            ),
          ),
        const SizedBox(height: AppSpacing.xl),
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Material(
            color: Colors.transparent,
            child: AppListTile(
              leading: Icon(Icons.receipt_long_outlined,
                  color: colors.textSecondary),
              title: l10n.billingHistoryTitle,
              trailing: Icon(Icons.chevron_right_rounded,
                  size: 20, color: colors.textSecondary),
              onTap: () => context.push(Routes.billingHistory),
            ),
          ),
        ),
      ],
    );
  }
}

class _OwnerOnly extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return Center(
      child: Padding(
        padding: AppSpacing.screenH,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_outline_rounded, size: 40, color: colors.textSecondary),
            const SizedBox(height: AppSpacing.md),
            Text(
              l10n.billingOwnerOnly,
              style: AppTypography.bodyMedium.copyWith(
                color: colors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: l10n.billingBack,
              variant: AppButtonVariant.secondary,
              onPressed: () => Navigator.of(context).maybePop(),
            ),
          ],
        ),
      ),
    );
  }
}
