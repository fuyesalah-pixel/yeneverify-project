import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/security/secure_screen.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/inputs/app_pin_field.dart';
import '../providers/auth_flow_providers.dart';

/// PIN setup — first entry, then confirm within this screen. Step 21.
/// After successful set, navigates to biometric enrollment (the auth state
/// stays `pinSetup` until that step is completed or skipped).
class PinSetupScreen extends ConsumerWidget {
  const PinSetupScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);

    // Watch for completion → navigate to biometric enrollment.
    ref.listen<PinFlowState>(pinSetupFlowProvider, (prev, next) {
      if (next.stage == PinStage.done) {
        context.go(Routes.biometricEnroll);
      }
    });

    final flow = ref.watch(pinSetupFlowProvider);
    final notifier = ref.read(pinSetupFlowProvider.notifier);
    final isConfirm = flow.stage == PinStage.confirmEntry;
    final errorText =
        flow.mismatch ? l10n.pinMismatch : flow.error?.userFacingMessage(l10n);

    return SecureScreen(
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => context.go(Routes.login),
          ),
        ),
        backgroundColor: colors.background,
        body: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.xl),
              Text(
                isConfirm ? l10n.pinConfirmTitle : l10n.pinSetupTitle,
                style: AppTypography.headingMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.pinSetupSubtitle,
                style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xxl),
              if (flow.isLoading)
                const Center(child: CircularProgressIndicator())
              else
                AppPinField(
                  // A new key empties the dots when moving from first entry to
                  // confirm (and back on a mismatch / server error).
                  key: ValueKey(flow.stage),
                  length: 4,
                  hasError: flow.hasError,
                  onCompleted: (pin) {
                    if (isConfirm) {
                      notifier.onConfirmEntry(pin);
                    } else {
                      notifier.onFirstEntry(pin);
                    }
                  },
                ),
              const SizedBox(height: AppSpacing.md),
              if (errorText != null)
                Text(
                  errorText,
                  style: AppTypography.bodySmall.copyWith(color: colors.error),
                  textAlign: TextAlign.center,
                ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
