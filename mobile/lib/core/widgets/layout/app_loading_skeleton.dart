import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_spacing.dart';

/// # AppLoadingSkeleton
///
/// Shimmer-based skeleton loader primitives.
///
/// ## Why shimmer, not spinner?
/// Skeletons communicate content shape, which reduces perceived load time
/// and avoids layout shifts when real content arrives.
///
/// ## Primitives
/// - [AppSkeleton.rect] — rectangular block (cards, images).
/// - [AppSkeleton.text] — text line placeholder.
/// - [AppSkeleton.circle] — avatar / icon placeholder.
///
/// ## Pre-built layouts
/// - [TransactionListSkeleton] — 5 transaction rows.
/// - [CardSkeleton] — a single card with title + 2 text lines.
///
/// ## Example
/// ```dart
/// state.isLoading
///   ? const TransactionListSkeleton()
///   : TransactionList(items: state.items)
/// ```

// ─── Shimmer wrapper ──────────────────────────────────────────────────────────

/// Wraps children in a shimmer animation using theme-aware base/highlight colors.
class AppShimmer extends StatelessWidget {
  const AppShimmer({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Shimmer.fromColors(
      baseColor: colors.shimmerBase,
      highlightColor: colors.shimmerHighlight,
      child: child,
    );
  }
}

// ─── Primitives ───────────────────────────────────────────────────────────────

/// Skeleton primitives — use inside an [AppShimmer].
abstract final class AppSkeleton {
  /// A rectangular skeleton block.
  static Widget rect({
    double? width,
    double height = 16,
    double? radius,
    EdgeInsetsGeometry? margin,
  }) {
    return Builder(builder: (context) {
      final colors = context.colors;
      return Container(
        width: width,
        height: height,
        margin: margin,
        decoration: BoxDecoration(
          color: colors.shimmerBase,
          borderRadius: BorderRadius.circular(radius ?? AppRadii.sm),
        ),
      );
    });
  }

  /// A text-line skeleton (short width, thin height).
  static Widget text({
    double? width,
    double height = 14,
    EdgeInsetsGeometry? margin,
  }) {
    return rect(width: width, height: height, margin: margin);
  }

  /// A circular skeleton (avatar, icon).
  static Widget circle({double size = 40}) {
    return Builder(builder: (context) {
      final colors = context.colors;
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: colors.shimmerBase,
          shape: BoxShape.circle,
        ),
      );
    });
  }
}

// ─── Pre-built skeleton layouts ───────────────────────────────────────────────

/// Skeleton for a single transaction list row.
class TransactionRowSkeleton extends StatelessWidget {
  const TransactionRowSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      child: Row(
        children: [
          AppSkeleton.circle(size: 44),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppSkeleton.text(width: 140, height: 14),
                const SizedBox(height: AppSpacing.xs),
                AppSkeleton.text(width: 96, height: 12),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              AppSkeleton.text(width: 72, height: 14),
              const SizedBox(height: AppSpacing.xs),
              AppSkeleton.rect(width: 60, height: 20, radius: AppRadii.pill),
            ],
          ),
        ],
      ),
    );
  }
}

/// Skeleton for a list of 5 transaction rows.
class TransactionListSkeleton extends StatelessWidget {
  const TransactionListSkeleton({super.key, this.count = 5});
  final int count;

  @override
  Widget build(BuildContext context) {
    return AppShimmer(
      child: Column(
        children: List.generate(
          count,
          (_) => const TransactionRowSkeleton(),
        ),
      ),
    );
  }
}

/// Skeleton for a summary card (title + 2 body lines).
class CardSkeleton extends StatelessWidget {
  const CardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return AppShimmer(
      child: Container(
        padding: AppSpacing.card,
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadii.radiusLg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppSkeleton.text(width: 120, height: 16),
            const SizedBox(height: AppSpacing.md),
            AppSkeleton.text(height: 14),
            const SizedBox(height: AppSpacing.xs),
            AppSkeleton.text(width: 200, height: 14),
          ],
        ),
      ),
    );
  }
}

/// Skeleton for a verification result card.
class VerificationCardSkeleton extends StatelessWidget {
  const VerificationCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return AppShimmer(
      child: Container(
        padding: AppSpacing.card,
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadii.radiusLg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                AppSkeleton.circle(size: 48),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppSkeleton.text(width: 100, height: 16),
                      const SizedBox(height: AppSpacing.xs),
                      AppSkeleton.text(width: 160, height: 12),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            AppSkeleton.rect(height: 48, radius: AppRadii.md),
            const SizedBox(height: AppSpacing.md),
            AppSkeleton.text(height: 14),
            const SizedBox(height: AppSpacing.xs),
            AppSkeleton.text(width: 180, height: 14),
            const SizedBox(height: AppSpacing.xs),
            AppSkeleton.text(width: 140, height: 14),
          ],
        ),
      ),
    );
  }
}
