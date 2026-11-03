// First-load skeleton: the same blocks as the real dashboard, so nothing
// jumps when data lands.
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/layout/app_loading_skeleton.dart';

class DashboardSkeleton extends StatelessWidget {
  const DashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return SafeArea(
      child: AppShimmer(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.xxxl,
          ),
          children: [
            Row(
              children: [
                Expanded(child: AppSkeleton.text(width: 180, height: 22)),
                AppSkeleton.circle(size: 28),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            Container(
              height: 132,
              decoration: BoxDecoration(
                color: colors.surfaceAlt,
                borderRadius: AppRadii.radiusLg,
              ),
              padding: AppSpacing.insetLg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppSkeleton.text(width: 160, height: 20),
                  const SizedBox(height: AppSpacing.md),
                  AppSkeleton.text(width: 120, height: 16),
                  const Spacer(),
                  AppSkeleton.rect(
                      width: 96, height: 28, radius: AppRadii.pill),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            const Row(
              children: [
                Expanded(child: _StatBlock()),
                SizedBox(width: AppSpacing.md),
                Expanded(child: _StatBlock()),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            AppSkeleton.text(width: 140, height: 18),
            const SizedBox(height: AppSpacing.md),
            const TransactionListSkeleton(count: 4),
          ],
        ),
      ),
    );
  }
}

class _StatBlock extends StatelessWidget {
  const _StatBlock();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      height: 96,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.radiusLg,
      ),
      padding: AppSpacing.insetLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSkeleton.text(width: 70, height: 12),
          const SizedBox(height: AppSpacing.md),
          AppSkeleton.text(width: 96, height: 22),
        ],
      ),
    );
  }
}
