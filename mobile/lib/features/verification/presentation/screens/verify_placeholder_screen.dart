// Verification placeholder — Step 22 replaces internals.
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';

class VerifyPlaceholderScreen extends StatelessWidget {
  const VerifyPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      body: const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.receipt_long, size: 64),
            SizedBox(height: AppSpacing.md),
            Text(
              'Verify a payment (Step 22)',
              style: AppTypography.headingMedium,
            ),
          ],
        ),
      ),
    );
  }
}
