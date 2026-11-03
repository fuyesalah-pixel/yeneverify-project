// Dashboard placeholder — Step 24 replaces internals.
import 'package:flutter/foundation.dart' show kDebugMode;
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
import '../../../auth/domain/auth_notifier.dart' show authProvider;
import '../../../auth/presentation/providers/dev_overrides.dart';

class DashboardPlaceholderScreen extends ConsumerWidget {
  const DashboardPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authProvider).valueOrNull;

    // Prefer the business just created during onboarding, then the person's
    // name (empty for fresh accounts), then the masked login phone.
    final businessName = auth?.businessName?.trim() ?? '';
    final fullName = auth?.user?.fullName.trim() ?? '';
    final phone = auth?.user?.phone ?? auth?.lastLoginPhone ?? '';
    final displayName = businessName.isNotEmpty
        ? businessName
        : fullName.isNotEmpty
            ? fullName
            : _maskPhone(phone);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.appName),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: l10n.logoutLabel,
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go(Routes.login);
            },
          ),
        ],
      ),
      backgroundColor: colors.background,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.dashboard, size: 64),
              const SizedBox(height: AppSpacing.md),
              Text(
                displayName.isEmpty ? 'Welcome' : 'Welcome, $displayName',
                style: AppTypography.headingMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Dashboard (Step 24)',
                style: AppTypography.bodyMedium.copyWith(
                  color: colors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              if (auth?.onboardingStep != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Onboarding: ${auth!.onboardingStep}',
                  style: AppTypography.bodySmall.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
              // Step 22B: the verify screen is the app's primary surface but
              // the bottom nav arrives with the real dashboard (Step 24), so
              // this placeholder links to it until then.
              const SizedBox(height: AppSpacing.xxl),
              AppButton(
                label: l10n.verifyHeading,
                icon: Icons.document_scanner_outlined,
                onPressed: () => context.push(Routes.verify),
              ),
              if (kDebugMode) ...[
                const SizedBox(height: AppSpacing.xl),
                TextButton(
                  onPressed: () => _refreshOnboarding(context, ref),
                  child: const Text('Dev: refresh onboarding status'),
                ),
                TextButton(
                  onPressed: () => _devReset(context, ref),
                  child: const Text('Dev: reset auth'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _refreshOnboarding(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final error =
        await ref.read(authProvider.notifier).refreshOnboardingStatus();
    if (!context.mounted) return;
    AppSnackbar.show(
      context,
      message: error == null
          ? 'Onboarding status refreshed'
          : error.userFacingMessage(),
      variant:
          error == null ? AppSnackbarVariant.success : AppSnackbarVariant.error,
    );
  }

  Future<void> _devReset(BuildContext context, WidgetRef ref) async {
    await devResetAuth(ref);
    if (context.mounted) context.go(Routes.login);
  }

  String _maskPhone(String phone) {
    if (phone.length < 8) return phone;
    return '${phone.substring(0, 7)}•••${phone.substring(phone.length - 2)}';
  }
}
