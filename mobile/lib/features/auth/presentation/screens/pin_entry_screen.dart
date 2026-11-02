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
import '../../data/biometric_service.dart';
import '../../domain/auth_notifier.dart'
    show AuthStatus, authStatusProvider, authProvider;
import '../providers/auth_flow_providers.dart';

/// Unlock screen — PIN entry (or an automatic biometric attempt). Step 21.
class PinEntryScreen extends ConsumerStatefulWidget {
  const PinEntryScreen({super.key});

  @override
  ConsumerState<PinEntryScreen> createState() => _PinEntryScreenState();
}

class _PinEntryScreenState extends ConsumerState<PinEntryScreen> {
  bool _bioPrompted = false;
  String? _bioError;

  @override
  void initState() {
    super.initState();
    // Auto-attempt biometric unlock once when the screen opens.
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeBiometricUnlock());
  }

  Future<void> _maybeBiometricUnlock({bool manual = false}) async {
    if (_bioPrompted && !manual) return;
    final auth = ref.read(authProvider).valueOrNull;
    if (auth?.biometricEnabled != true && !manual) return;
    _bioPrompted = true;
    final l10n = AppLocalizations.of(context);

    final passed = await ref
        .read(biometricServiceProvider)
        .authenticate(reason: l10n.biometricPrompt);
    if (!passed) {
      if (mounted) setState(() => _bioError = l10n.biometricFailed);
      return;
    }
    final error =
        await ref.read(authProvider.notifier).unlockWithBiometric();
    if (!mounted) return;
    setState(() {
      _bioError = error?.userFacingMessage(l10n);
    });
  }

  Future<void> _forgotPin() async {
    // A forgotten PIN means re-authenticating from scratch with OTP.
    await ref.read(authProvider.notifier).logout();
    if (mounted) context.go(Routes.login);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);

    // On successful unlock (PIN or biometric), move on to the dashboard.
    ref.listen<AuthStatus>(authStatusProvider, (prev, next) {
      if (next == AuthStatus.unlocked) context.go(Routes.dashboard);
    });

    final flow = ref.watch(pinEntryFlowProvider);
    final notifier = ref.read(pinEntryFlowProvider.notifier);
    final auth = ref.watch(authProvider).valueOrNull;
    final displayName = auth?.lastLoginPhone ?? '';

    final lockoutMinutes = (flow.error?.retryAfterSeconds != null &&
            flow.error!.retryAfterSeconds! > 0)
        ? (flow.error!.retryAfterSeconds! / 60).ceil()
        : 15;
    final errorText = flow.isLockedOut
        ? l10n.pinLocked(lockoutMinutes)
        : (flow.error?.userFacingMessage(l10n) ?? _bioError);

    return SecureScreen(
      child: Scaffold(
        appBar: AppBar(title: Text(l10n.appName)),
        backgroundColor: colors.background,
        body: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.xxl),
              Text(
                l10n.pinEntryTitle,
                style: AppTypography.headingMedium,
                textAlign: TextAlign.center,
              ),
              if (displayName.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  displayName,
                  style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: AppSpacing.xxl),
              if (flow.isLockedOut)
                Text(
                  errorText ?? l10n.pinLocked(lockoutMinutes),
                  style: AppTypography.bodyMedium.copyWith(color: colors.error),
                  textAlign: TextAlign.center,
                )
              else if (flow.isLoading)
                const Center(child: CircularProgressIndicator())
              else
                AppPinField(
                  length: 4,
                  hasError: flow.hasError,
                  onCompleted: (pin) => notifier.unlock(pin),
                ),
              const SizedBox(height: AppSpacing.md),
              if (!flow.isLockedOut && errorText != null)
                Text(
                  errorText,
                  style: AppTypography.bodySmall.copyWith(color: colors.error),
                  textAlign: TextAlign.center,
                ),
              const SizedBox(height: AppSpacing.xl),
              TextButton(
                onPressed: _forgotPin,
                child: Text(
                  l10n.pinEntryForgot,
                  style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
                ),
              ),
              if (auth?.biometricEnabled == true && !flow.isLockedOut) ...[
                const SizedBox(height: AppSpacing.sm),
                TextButton.icon(
                  icon: const Icon(Icons.fingerprint),
                  label: Text(l10n.biometricEnable),
                  onPressed: () => _maybeBiometricUnlock(manual: true),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
