import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/env/app_env.dart';
import '../../../../core/network/api_error.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/inputs/app_text_field.dart';
import '../providers/auth_flow_providers.dart';
import '../providers/dev_overrides.dart';

/// Login screen — phone entry → OTP. Step 21.
class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);
    final flow = ref.watch(loginFlowProvider);
    final notifier = ref.read(loginFlowProvider.notifier);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 600),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  l10n.loginTitle,
                  style: AppTypography.displayLarge.copyWith(
                    color: colors.primaryAction,
                    fontSize: 40,
                    letterSpacing: -1.2,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  l10n.loginSubtitle,
                  style: AppTypography.bodyLarge.copyWith(color: colors.textSecondary),
                ),
                const SizedBox(height: AppSpacing.xl),
                AppTextField(
                  label: l10n.phoneNumber,
                  hint: l10n.phoneHint,
                  errorText: flow.phone.isNotEmpty && !flow.isValid ? l10n.phoneInvalid : null,
                  keyboardType: TextInputType.phone,
                  onChanged: notifier.setPhone,
                ),
                const SizedBox(height: AppSpacing.sm),
                if (flow.error != null)
                  Text(
                    flow.error!.userFacingMessage(l10n),
                    style: AppTypography.bodySmall.copyWith(color: colors.error),
                    textAlign: TextAlign.center,
                  ),
                const SizedBox(height: AppSpacing.lg),
                AppButton(
                  label: l10n.continueLabel,
                  onPressed: flow.isValid && !flow.isLoading
                      ? () async {
                          FocusScope.of(context).unfocus();
                          final ok = await notifier.submit();
                          if (ok && context.mounted) {
                            context.pushReplacement(
                              Routes.otp,
                              extra: normalizeEthiopianPhone(flow.phone),
                            );
                          }
                        }
                      : null,
                  isLoading: flow.isLoading,
                ),

                // Dev-only footer: API base URL + overrides. Stripped in release.
                if (kDebugMode) ...[
                  const SizedBox(height: AppSpacing.xxl),
                  Text(
                    'Dev: ${AppEnv.apiBaseUrl}',
                    style: AppTypography.bodySmall.copyWith(color: colors.textDisabled),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      TextButton(
                        onPressed: () => devSkipAuth(ref),
                        child: const Text('Dev: skip auth'),
                      ),
                      TextButton(
                        onPressed: () => devResetAuth(ref),
                        child: const Text('Dev: reset auth'),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
