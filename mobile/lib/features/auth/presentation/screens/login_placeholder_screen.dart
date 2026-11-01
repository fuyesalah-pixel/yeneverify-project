import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/inputs/app_text_field.dart';

/// # LoginPlaceholderScreen (Step 20 placeholder)
///
/// Visual placeholder only — Step 21 replaces the internals with the real
/// OTP auth flow. The layout, spacing, and components already use the final
/// design system so the transition is purely functional.
class LoginPlaceholderScreen extends StatefulWidget {
  const LoginPlaceholderScreen({super.key});

  @override
  State<LoginPlaceholderScreen> createState() => _LoginPlaceholderScreenState();
}

class _LoginPlaceholderScreenState extends State<LoginPlaceholderScreen> {
  final _phoneController = TextEditingController();

  // Placeholder behaviour: "Continue" stays disabled until SOME input is
  // present. Incomplete phone numbers intentionally do NOT enable the
  // button — real validation arrives with Step 21.
  bool get _hasInput => _phoneController.text.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    _phoneController.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: AppSpacing.screenH,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: AppSpacing.giant),

                // Heading
                Text(
                  l10n.appName,
                  style: AppTypography.displayLarge.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),

                // Subtitle
                Text(
                  l10n.taglinePrimary,
                  style: AppTypography.bodyLarge.copyWith(
                    color: colors.textSecondary,
                  ),
                ),

                const SizedBox(height: AppSpacing.colossal),

                // Phone input
                AppTextField(
                  hint: l10n.phoneHint,
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  prefixIcon: Icons.phone_outlined,
                ),

                const SizedBox(height: AppSpacing.xxl),

                // Primary action
                AppButton(
                  label: l10n.continueLabel,
                  onPressed:
                      _hasInput ? () => _onContinue(context, l10n) : null,
                ),

                const SizedBox(height: AppSpacing.lg),

                // Tertiary action (dead for now)
                AppButton(
                  label: l10n.learnMoreLabel,
                  variant: AppButtonVariant.ghost,
                  onPressed: () {},
                ),

                // Step 20 debug affordance — removed in Step 21.
                AppButton(
                  label: l10n.debugDesignSystem,
                  variant: AppButtonVariant.ghost,
                  onPressed: () => context.push(Routes.designSystem),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _onContinue(BuildContext context, AppLocalizations l10n) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(l10n.authComingSoon)));
  }
}
