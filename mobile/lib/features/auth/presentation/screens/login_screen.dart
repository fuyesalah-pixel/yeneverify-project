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
import '../../../../core/widgets/layout/app_card.dart';
import '../../../auth/domain/google_auth_provider.dart';
import '../providers/auth_flow_providers.dart';
import '../providers/dev_overrides.dart';

/// Login screen — Google Sign-In primary, phone + OTP fallback. Step 21.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phoneFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    // Pre-load device accounts so returning Google users see their phones.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(googleAuthProvider.notifier).init();
    });
  }

  @override
  void dispose() {
    _phoneFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);
    final flow = ref.watch(loginFlowProvider);
    final notifier = ref.read(loginFlowProvider.notifier);
    final googleAuth = ref.watch(googleAuthProvider);

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

                // ── Google Sign-In (primary) ─────────────────────────────
                _GoogleSignInSection(
                  onSignIn: _handleGoogleSignIn,
                  status: googleAuth.status,
                  error: googleAuth.error,
                  l10n: l10n,
                ),

                const SizedBox(height: AppSpacing.lg),

                // ── Phone fallback link ──────────────────────────────────
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => _phoneFocus.requestFocus(),
                    child: Text(
                      l10n.orSignInWithPhone,
                      style: AppTypography.bodyMedium.copyWith(
                        color: colors.primaryAction,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: AppSpacing.xxl),

                // ── Phone entry (fallback) ───────────────────────────────
                AppTextField(
                  label: l10n.phoneNumber,
                  hint: l10n.phoneHint,
                  errorText: flow.phone.isNotEmpty && !flow.isValid ? l10n.phoneInvalid : null,
                  keyboardType: TextInputType.phone,
                  focusNode: _phoneFocus,
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

                // ── Device accounts (paired Google accounts) ─────────────
                if (googleAuth.deviceAccounts.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xxl),
                  Text(
                    l10n.devicesTitle,
                    style: AppTypography.headingSmall.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  ...googleAuth.deviceAccounts.map(
                    (account) => ListTile(
                      leading: const Icon(Icons.account_circle_rounded),
                      title: Text(account.googleEmail),
                      subtitle: Text(l10n.devicePhoneSuffix(account.phoneLast4)),
                      trailing: const Icon(Icons.chevron_right_rounded, size: 20),
                      onTap: () {
                        // Selecting a paired device account signs in with Google
                        // directly (no phone needed).
                        ref.read(googleAuthProvider.notifier).signInWithGoogle();
                      },
                    ),
                  ),
                ],

                const SizedBox(height: AppSpacing.xxl),

                // Dev-only footer.
                if (kDebugMode) ...[
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

  Future<void> _handleGoogleSignIn() async {
    final notifier = ref.read(googleAuthProvider.notifier);
    final account = await notifier.signInWithGoogle();
    if (!context.mounted || account == null) return;

    // If the provider says pairing is required, navigate to the pairing screen.
    final state = ref.read(googleAuthProvider);
    if (state.requiresPairing && state.googleAccount != null) {
      final paired = await context.push<bool>(Routes.phonePairing);
      if (paired == true && context.mounted) {
        context.go(Routes.dashboard);
      }
      return;
    }

    // Otherwise sign-in completed; navigate to dashboard.
    if (context.mounted) {
      context.go(Routes.dashboard);
    }
  }
}

class _GoogleSignInSection extends ConsumerWidget {
  const _GoogleSignInSection({
    required this.onSignIn,
    required this.status,
    required this.error,
    required this.l10n,
  });

  final VoidCallback onSignIn;
  final GoogleAuthStatus status;
  final ApiError? error;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final isLoading = status == GoogleAuthStatus.signingIn;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.googleSignInTitle,
            style: AppTypography.headingMedium.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.googleSignInSubtitle,
            style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: l10n.googleSignInButton,
            icon: Icons.login,
            onPressed: isLoading ? null : onSignIn,
            isLoading: isLoading,
            variant: AppButtonVariant.primary,
          ),
          if (error != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              error!.userFacingMessage(l10n),
              style: AppTypography.bodySmall.copyWith(color: colors.error),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}
