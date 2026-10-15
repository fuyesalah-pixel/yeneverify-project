import 'package:flutter/material.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';
import '../buttons/app_button.dart';

/// # AppErrorState
///
/// Full-screen or inline error state with icon, human-readable message,
/// and a single retry CTA.
///
/// ## Design rules
/// - Never show raw error messages, stack traces, or server codes to the user.
/// - Always provide a retry action where applicable.
/// - Use [AppColors.error] only for the icon — not the entire background.
///
/// ## When to use
/// - Network failures loading a list or screen.
/// - Bank adapter returning [VerificationStatus.error].
/// - Unexpected app errors (caught by error boundary).
///
/// ## When NOT to use
/// - Form validation errors — use [AppTextField] `errorText` for those.
/// - Toast-level errors — use [AppSnackbar].
///
/// ## Example
/// ```dart
/// AppErrorState(
///   message: context.l10n.networkError,
///   onRetry: () => ref.refresh(transactionsProvider),
/// )
/// ```
class AppErrorState extends StatelessWidget {
  const AppErrorState({
    super.key,
    required this.message,
    this.retryLabel,
    this.onRetry,
    this.compact = false,
    this.icon,
  });

  final String message;
  final String? retryLabel;
  final VoidCallback? onRetry;
  final bool compact;

  /// Override the icon. Defaults to a warning triangle.
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final vPad = compact ? AppSpacing.xxl : AppSpacing.giant;

    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacing.xxxl,
          vertical: vPad,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: colors.error.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon ?? Icons.warning_amber_rounded,
                size: 36,
                color: colors.error,
              ),
            ),

            SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xl),

            Text(
              message,
              style: AppTypography.bodyLarge.copyWith(
                color: colors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),

            if (onRetry != null) ...[
              SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xxl),
              AppButton(
                label: retryLabel ?? 'Try again',
                onPressed: onRetry,
                variant: AppButtonVariant.secondary,
                size: AppButtonSize.md,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
