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
import '../../../../core/widgets/buttons/app_button.dart';
import '../../data/biometric_service.dart';
import '../../domain/auth_notifier.dart' show authProvider;
import '../providers/auth_flow_providers.dart';

/// Biometric enrollment prompt, shown right after PIN setup. Step 21.
///
/// A real OS biometric prompt runs first (local_auth), then the backend is
/// told to enable biometric unlock using a PIN step-up token. On emulators
/// without enrolled biometrics, debug builds let the flow continue.
class BiometricEnrollScreen extends ConsumerStatefulWidget {
  const BiometricEnrollScreen({super.key});

  @override
  ConsumerState<BiometricEnrollScreen> createState() => _BiometricEnrollScreenState();
}

class _BiometricEnrollScreenState extends ConsumerState<BiometricEnrollScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _finish() async {
    await ref.read(authProvider.notifier).completeEnrollment();
    ref.read(pinSetupFlowProvider.notifier).reset();
    final needsOnboarding =
        ref.read(authProvider).valueOrNull?.needsOnboarding ?? false;
    if (mounted) {
      context.go(needsOnboarding ? Routes.onboarding : Routes.dashboard);
    }
  }

  Future<void> _enable({required String pin}) async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (pin.isEmpty) {
        setState(() => _error = l10n.genericError);
        return;
      }

      final passed = await ref
          .read(biometricServiceProvider)
          .authenticate(reason: l10n.biometricPrompt);
      if (!passed) {
        if (mounted) setState(() => _error = l10n.biometricFailed);
        return;
      }

      final error =
          await ref.read(authProvider.notifier).enableBiometric(pin: pin);
      if (!mounted) return;
      if (error != null) {
        setState(() => _error = error.userFacingMessage(l10n));
        return;
      }
      await _finish();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _skip() => _finish();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);
    final pin = ref.read(pinSetupFlowProvider).firstPin;

    return SecureScreen(
      child: Scaffold(
        appBar: AppBar(),
        backgroundColor: colors.background,
        body: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Icon(
                Icons.fingerprint,
                size: 96,
                color: colors.primaryAction,
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                l10n.biometricTitle,
                style: AppTypography.headingMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.biometricSubtitle,
                style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              if (_error != null) ...[
                Text(
                  _error!,
                  style: AppTypography.bodySmall.copyWith(color: colors.error),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              if (_busy)
                const Center(child: CircularProgressIndicator())
              else ...[
                AppButton(label: l10n.biometricEnable, onPressed: () => _enable(pin: pin)),
                const SizedBox(height: AppSpacing.sm),
                AppButton(
                  label: l10n.biometricSkip,
                  variant: AppButtonVariant.ghost,
                  onPressed: _skip,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
