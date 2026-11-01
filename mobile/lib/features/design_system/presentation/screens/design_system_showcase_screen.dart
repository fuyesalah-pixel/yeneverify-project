import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/theme_mode_provider.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/fintech/amount_text.dart';
import '../../../../core/widgets/fintech/bank_logo.dart';
import '../../../../core/widgets/fintech/credit_meter.dart';
import '../../../../core/widgets/fintech/reference_chip.dart';
import '../../../../core/widgets/fintech/verdict_badge.dart';
import '../../../../core/widgets/inputs/app_otp_field.dart';
import '../../../../core/widgets/inputs/app_pin_field.dart';
import '../../../../core/widgets/inputs/app_text_field.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../../core/widgets/layout/app_empty_state.dart';
import '../../../../core/widgets/layout/app_error_state.dart';
import '../../../../core/widgets/layout/app_loading_skeleton.dart';

/// # DesignSystemShowcaseScreen
///
/// The Step 20 demo screen: every Step 2 widget rendered in one scrollable
/// gallery, with a sun/moon toggle for instant light/dark comparison.
/// Demo-only content — hard-coded sample data, no business logic.
class DesignSystemShowcaseScreen extends StatelessWidget {
  const DesignSystemShowcaseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: const Text('Design System')),
      body: SingleChildScrollView(
        padding: AppSpacing.screen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _section(context, 'Typography', 0),
            _typographySection(context),
            _section(context, 'Buttons', 0),
            _buttonsSection(context),
            _section(context, 'Inputs', 0),
            _inputsSection(context),
            _section(context, 'Cards', 0),
            _cardsSection(context),
            _section(context, 'Fintech components', 0),
            _fintechSection(context),
            _section(context, 'Feedback', 0),
            _feedbackSection(context),
            _section(context, 'Colors', 0),
            _colorsSection(context),
            _section(context, 'Theme toggle', 0),
            _themeToggleSection(context),
            const SizedBox(height: AppSpacing.huge),
          ],
        ),
      ),
    );
  }

  // ─── Sections ─────────────────────────────────────────────────────────────

  Widget _section(BuildContext context, String title, double indent) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: AppSpacing.xxxl),
        Text(
          title,
          style: AppTypography.headingMedium
              .copyWith(color: context.colors.textPrimary),
        ),
        const Divider(height: AppSpacing.xxl),
      ],
    );
  }

  Widget _typographySection(BuildContext context) {
    final styles = {
      'displayLarge 32/700': AppTypography.displayLarge,
      'displayMedium 28/700': AppTypography.displayMedium,
      'headingLarge 24/700': AppTypography.headingLarge,
      'headingMedium 20/600': AppTypography.headingMedium,
      'headingSmall 18/600': AppTypography.headingSmall,
      'bodyLarge 16/400': AppTypography.bodyLarge,
      'bodyMedium 14/400': AppTypography.bodyMedium,
      'bodySmall 12/400': AppTypography.bodySmall,
      'labelLarge 16/600': AppTypography.labelLarge,
      'labelMedium 14/500': AppTypography.labelMedium,
      'labelSmall 12/500': AppTypography.labelSmall,
      'mono 14/500': AppTypography.mono,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final entry in styles.entries) ...[
          Text(entry.key,
              style: entry.value.copyWith(color: context.colors.textPrimary)),
          const SizedBox(height: AppSpacing.md),
        ],
      ],
    );
  }

  Widget _buttonsSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppButton(label: 'Primary', onPressed: () {}),
        const SizedBox(height: AppSpacing.lg),
        AppButton(label: 'Secondary', variant: AppButtonVariant.secondary, onPressed: () {}),
        const SizedBox(height: AppSpacing.lg),
        AppButton(label: 'Ghost', variant: AppButtonVariant.ghost, onPressed: () {}),
        const SizedBox(height: AppSpacing.lg),
        AppButton(label: 'Danger', variant: AppButtonVariant.danger, onPressed: () {}),
        const SizedBox(height: AppSpacing.xl),
        AppButton(label: 'Primary disabled'),
        const SizedBox(height: AppSpacing.lg),
        AppButton(label: 'Secondary disabled', variant: AppButtonVariant.secondary),
        const SizedBox(height: AppSpacing.lg),
        AppButton(label: 'Ghost disabled', variant: AppButtonVariant.ghost),
        const SizedBox(height: AppSpacing.lg),
        AppButton(label: 'Danger disabled', variant: AppButtonVariant.danger),
        const SizedBox(height: AppSpacing.xl),
        const AppButton(label: 'Primary loading', isLoading: true),
        const SizedBox(height: AppSpacing.lg),
        const AppButton(label: 'Ghost loading', variant: AppButtonVariant.ghost, isLoading: true),
      ],
    );
  }

  Widget _inputsSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const AppTextField(hint: 'Default field'),
        const SizedBox(height: AppSpacing.lg),
        const AppTextField(hint: 'Field with error', errorText: 'This is not accurate'),
        const SizedBox(height: AppSpacing.lg),
        AppOtpField(autofocus: false, onCompleted: (_) {}),
        const SizedBox(height: AppSpacing.lg),
        AppPinField(autofocus: false, length: 4, onCompleted: (_) {}),
      ],
    );
  }

  Widget _cardsSection(BuildContext context) {
    return Column(
      children: [
        AppCard(
          child: SizedBox(
            width: double.infinity,
            child: Text('Empty card',
                style: AppTypography.bodyMedium.copyWith(
                  color: context.colors.textSecondary,
                )),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Card with content',
                  style: AppTypography.headingSmall
                      .copyWith(color: context.colors.textPrimary)),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Grouped content lives on the surface layer with an 16px '
                'radius and either a thin border or a subtle shadow.',
                style: AppTypography.bodyMedium
                    .copyWith(color: context.colors.textSecondary),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _fintechSection(BuildContext context) {
    final verdicts = VerificationVerdict.values;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const AmountText(amountMinor: 550000, size: AmountTextSize.display),
        const SizedBox(height: AppSpacing.lg),
        Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.md,
          children: [
            for (final v in verdicts) VerdictBadge(verdict: v),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        const Center(child: CreditMeter(remaining: 42, total: 400)),
        const SizedBox(height: AppSpacing.xl),
        const Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            BankLogo(bankCode: 'CBE', size: 36),
            BankLogo(bankCode: 'TELEBIRR', size: 36),
            BankLogo(bankCode: 'AWASH', size: 36),
            BankLogo(bankCode: 'DASHEN', size: 36),
            BankLogo(bankCode: 'ABYSSINIA', size: 36),
            BankLogo(bankCode: 'MPESA', size: 36),
            BankLogo(bankCode: 'ZEMEN', size: 36),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        const ReferenceChip(reference: 'FT26195DBK5W81465291'),
      ],
    );
  }

  Widget _feedbackSection(BuildContext context) {
    return Column(
      children: [
        AppCard(
          child: Column(
            children: [
              const AppEmptyState(
                icon: Icons.receipt_long_outlined,
                title: 'No verifications yet',
                body: 'Verified payments will appear here.',
                actionLabel: 'Verify a payment',
                onAction: null,
                compact: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        AppCard(
          child: const AppErrorState(
            message: 'No internet connection. Please check your network.',
            retryLabel: 'Try again',
            onRetry: null,
            compact: true,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        AppShimmer(
          child: Column(
            children: [
              AppSkeleton.text(width: 180, height: 16),
              SizedBox(height: AppSpacing.md),
              AppSkeleton.text(height: 14),
              SizedBox(height: AppSpacing.sm),
              AppSkeleton.text(width: 220, height: 14),
            ],
          ),
        ),
      ],
    );
  }

  Widget _colorsSection(BuildContext context) {
    final tokens = <(String, Color, Color)>[
      ('background', AppColors.light.background, AppColors.dark.background),
      ('surface', AppColors.light.surface, AppColors.dark.surface),
      ('surfaceAlt', AppColors.light.surfaceAlt, AppColors.dark.surfaceAlt),
      ('textPrimary', AppColors.light.textPrimary, AppColors.dark.textPrimary),
      ('textSecondary', AppColors.light.textSecondary, AppColors.dark.textSecondary),
      ('onPrimary', AppColors.light.onPrimary, AppColors.dark.onPrimary),
      ('primaryAction', AppColors.light.primaryAction, AppColors.dark.primaryAction),
      ('primaryActionPressed', AppColors.light.primaryActionPressed, AppColors.dark.primaryActionPressed),
      ('brandAccent', AppColors.light.brandAccent, AppColors.dark.brandAccent),
      ('success', AppColors.light.success, AppColors.dark.success),
      ('warning', AppColors.light.warning, AppColors.dark.warning),
      ('error', AppColors.light.error, AppColors.dark.error),
      ('info', AppColors.light.info, AppColors.dark.info),
      ('border', AppColors.light.border, AppColors.dark.border),
    ];
    return Column(
      children: [
        for (final t in tokens)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Row(
              children: [
                _swatch(t.$2),
                const SizedBox(width: AppSpacing.sm),
                _swatch(t.$3),
                const SizedBox(width: AppSpacing.md),
                Text(t.$1,
                    style: AppTypography.bodySmall.copyWith(
                      color: context.colors.textSecondary,
                    )),
              ],
            ),
          ),
      ],
    );
  }

  Widget _swatch(Color color) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.light.border, width: 1),
      ),
    );
  }

  Widget _themeToggleSection(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) {
        final mode = ref.watch(themeModeProvider);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Current mode: ${mode.name}',
              style: AppTypography.bodyMedium.copyWith(
                color: context.colors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: mode == ThemeMode.light ? 'Switch to dark' : 'Switch to light',
              variant: AppButtonVariant.secondary,
              onPressed: () => _toggleTheme(ref),
            ),
          ],
        );
      },
    );
  }

  void _toggleTheme(WidgetRef ref) {
    final notifier = ref.read(themeModeProvider.notifier);
    notifier.state = notifier.state == ThemeMode.light
        ? ThemeMode.dark
        : ThemeMode.light;
  }
}
