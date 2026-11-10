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
import '../../../../core/widgets/brand/brand_logo.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../auth/domain/auth_notifier.dart'
    show AuthStatus, authStatusProvider;
import '../../../auth/domain/google_auth_provider.dart';
import '../providers/dev_overrides.dart';

/// Login screen — Google Sign-In only. Phone pairing happens after the Google
/// account is authenticated (see [Routes.phonePairing]).
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  @override
  void initState() {
    super.initState();
    // Pre-load device accounts so returning Google users see their phones.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(googleAuthProvider.notifier).init();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);
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
                BrandLogo(
                  height: 92,
                  semanticLabel: l10n.loginTitle,
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  l10n.loginSubtitle,
                  style: AppTypography.bodyLarge
                      .copyWith(color: colors.textSecondary),
                ),

                // ── Device accounts (paired Google accounts) ─────────────
                if (googleAuth.deviceAccounts.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    l10n.devicesTitle,
                    style: AppTypography.headingSmall.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final account in googleAuth.deviceAccounts)
                        Tooltip(
                          message: account.googleEmail,
                          child: ActionChip(
                            avatar: const Icon(
                              Icons.account_circle_rounded,
                              size: 18,
                            ),
                            label:
                                Text(l10n.devicePhoneSuffix(account.phoneLast4)),
                            onPressed: () {
                              // Selecting a paired device account signs in with
                              // Google directly (no phone needed).
                              ref
                                  .read(googleAuthProvider.notifier)
                                  .signInWithGoogle();
                            },
                          ),
                        ),
                    ],
                  ),
                ],

                const SizedBox(height: AppSpacing.xl),

                // ── Google Sign-In (only login method) ───────────────────
                _GoogleSignInSection(
                  onSignIn: _handleGoogleSignIn,
                  status: googleAuth.status,
                  error: googleAuth.error,
                  l10n: l10n,
                ),

                const SizedBox(height: AppSpacing.xxl),

                // Dev-only footer.
                if (kDebugMode) ...[
                  Text(
                    'Dev: ${AppEnv.apiBaseUrl}',
                    style: AppTypography.bodySmall
                        .copyWith(color: colors.textDisabled),
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
    if (!mounted || account == null) return;

    final state = ref.read(googleAuthProvider);
    if (state.status == GoogleAuthStatus.error) return;

    // New Google user: collect the phone number (no OTP) before continuing.
    if (state.requiresPairing && state.googleAccount != null) {
      final paired = await context.push<bool>(Routes.phonePairing);
      if (paired == true && mounted) _continueAfterAuth();
      return;
    }

    _continueAfterAuth();
  }

  /// Routes Google-authenticated users without racing the redirect guard:
  /// first-time users set a PIN, returning users unlock, everyone else lands
  /// on the dashboard (onboarding is handled by the guard).
  void _continueAfterAuth() {
    if (!mounted) return;
    switch (ref.read(authStatusProvider)) {
      case AuthStatus.pinSetup:
        context.go(Routes.pinSetup);
      case AuthStatus.locked:
        context.go(Routes.unlock);
      default:
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
            style:
                AppTypography.headingMedium.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.googleSignInSubtitle,
            style:
                AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
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
