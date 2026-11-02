// Onboarding placeholder — Step 22 replaces this screen entirely.
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/feedback/app_snackbar.dart';

/// Landing screen for an unlocked merchant who has not created a merchant
/// profile yet. The router sends `unlocked + needsOnboarding` here, so this
/// screen is the seam Step 22 fills with the real onboarding flow.
class OnboardingPlaceholderScreen extends StatelessWidget {
  const OnboardingPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      appBar: AppBar(title: const Text('Welcome to Yene Verify')),
      backgroundColor: colors.background,
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.storefront_outlined, size: 64),
            const SizedBox(height: AppSpacing.md),
            const Text(
              "Let's set up your business",
              style: AppTypography.headingMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Add your business details to start verifying receipts.',
              style: AppTypography.bodyMedium.copyWith(
                color: colors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            AppButton(
              label: 'Continue',
              onPressed: () => AppSnackbar.show(
                context,
                message: 'Onboarding — coming Step 22',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
