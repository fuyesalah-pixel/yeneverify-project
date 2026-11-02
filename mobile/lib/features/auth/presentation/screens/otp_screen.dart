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
import '../../../../core/widgets/inputs/app_otp_field.dart';
import '../../domain/auth_notifier.dart' show AuthStatus, authStatusProvider;
import '../providers/auth_flow_providers.dart';

/// OTP screen — 6-digit auto-submit code + countdown + resend. Step 21.
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.phone});

  /// Normalized (+251XXXXXXXXX) phone carried from the login screen.
  final String phone;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);
    final flow = ref.watch(otpFlowProvider);
    final notifier = ref.read(otpFlowProvider.notifier);
    final phone = widget.phone;

    return Scaffold(
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
            const SizedBox(height: AppSpacing.md),
            Text(
              l10n.otpTitle,
              style: AppTypography.headingMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.otpSubtitle(maskPhone(phone)),
              style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            AppOtpField(
              key: ValueKey(flow.resetToken),
              length: 6,
              hasError: flow.wrongCode,
              onChanged: (_) {
                if (flow.error != null) notifier.clearError();
              },
              onCompleted: (code) async {
                final ok = await notifier.verify(phone: phone, code: code);
                if (!ok || !context.mounted) {
                  return;
                }
                final status = ref.read(authStatusProvider);
                final destination = switch (status) {
                  AuthStatus.pinSetup => Routes.pinSetup,
                  AuthStatus.locked => Routes.unlock,
                  _ => Routes.dashboard,
                };
                context.go(destination);
              },
            ),
            const SizedBox(height: AppSpacing.md),
            if (flow.wrongCode)
              Text(
                flow.error?.userFacingMessage(l10n) ?? l10n.otpInvalid,
                style: AppTypography.bodySmall.copyWith(color: colors.error),
                textAlign: TextAlign.center,
              ),
            const SizedBox(height: AppSpacing.xl),
            if (flow.isResending)
              const AppButton(label: '...', isLoading: true, onPressed: null)
            else if (flow.canResend)
              AppButton(
                label: l10n.otpResend,
                variant: AppButtonVariant.secondary,
                onPressed: () => notifier.resend(phone),
              )
            else
              Text(
                l10n.otpResendIn(flow.secondsRemaining),
                style: AppTypography.bodySmall.copyWith(color: colors.textDisabled),
                textAlign: TextAlign.center,
              ),
            if (flow.isSubmitting) ...[
              const SizedBox(height: AppSpacing.lg),
              const Center(child: CircularProgressIndicator()),
            ],
          ],
        ),
      ),
    );
  }

  String maskPhone(String phone) {
    if (phone.length < 8) return phone;
    return '${phone.substring(0, 7)}•••${phone.substring(phone.length - 2)}';
  }
}
