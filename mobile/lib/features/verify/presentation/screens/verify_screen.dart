// Verify — the primary screen of the app (Step 22B Part 1).
//
// ONE job: hand a receipt image to the backend. Two inputs only (Master
// Context §3): take a photo, or upload an image. No QR, no paste, no URL.
//
// The screen is a tab root, so there is no back button. Every state after a
// pick happens in place — the two cards are replaced by progress, then by
// the verdict route once a terminal status arrives.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_shadows.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/layout/app_error_state.dart';
import '../providers/verify_controller.dart';
import '../verify_copy.dart';
import '../widgets/submitting_state.dart';
import '../widgets/upload_progress.dart';

class VerifyScreen extends ConsumerWidget {
  const VerifyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final current =
        ref.watch(verifyControllerProvider).valueOrNull ?? const IdleState();

    // A terminal verdict always moves to the verdict route. Resetting the
    // controller afterwards means coming back lands on fresh action cards.
    ref.listen<AsyncValue<VerifyState>>(verifyControllerProvider, (_, next) {
      final value = next.valueOrNull;
      if (value is! ResultState) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        context.push(Routes.verdict, extra: value.result);
        ref.read(verifyControllerProvider.notifier).retry();
      });
    });

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: Text(l10n.verifyTitle),
      ),
      body: SafeArea(
        child: Padding(
          padding: AppSpacing.screenH,
          child: switch (current) {
            IdleState() => _IdleBody(),
            CapturingState() => const _Preparing(),
            CompressingState() => const _Preparing(),
            UploadingState(:final progress) => Center(
                child: UploadProgress(progress: progress),
              ),
            SubmittingState() => const Center(child: VerifyingSkeleton()),
            PollingState(:final elapsed) =>
              Center(child: VerifyingSkeleton(elapsed: elapsed)),
            ResultState() => const Center(child: VerifyingSkeleton()),
            ErrorState(:final code, :final retryable) => _ErrorBody(
                message: verifyErrorMessage(l10n, code),
                retryable: retryable,
              ),
          },
        ),
      ),
    );
  }
}

// ─── Idle: heading + two action cards + credits ─────────────────────────────

class _IdleBody extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.xxxl),
          Text(
            l10n.verifyHeading,
            style: AppTypography.headingLarge.copyWith(
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.verifyHeadingSubtitle,
            style: AppTypography.bodyMedium.copyWith(
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.giant),
          _ActionCard(
            icon: Icons.camera_alt_outlined,
            title: l10n.takePhoto,
            subtitle: l10n.takePhotoCardSubtitle,
            accent: colors.primaryAction,
            highlighted: true,
            onTap: () => _openCamera(context, ref),
          ),
          const SizedBox(height: AppSpacing.lg),
          _ActionCard(
            icon: Icons.image_outlined,
            title: l10n.uploadImage,
            subtitle: l10n.uploadImageCardSubtitle,
            accent: colors.textPrimary,
            onTap: () => ref.read(verifyControllerProvider.notifier).startGallery(),
          ),
          const SizedBox(height: AppSpacing.xxxl),
          const _CreditsCard(),
        ],
      ),
    );
  }

  Future<void> _openCamera(BuildContext context, WidgetRef ref) async {
    final controller = ref.read(verifyControllerProvider.notifier);
    controller.startCamera();

    final captured = await context.push<File>(Routes.cameraCapture);
    if (!context.mounted) return;

    if (captured == null) {
      // User closed the camera without shooting — go back to the cards.
      controller.cancel();
      return;
    }
    await controller.submitCaptured(captured);
  }
}

class _Preparing extends StatelessWidget {
  const _Preparing();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: colors.primaryAction),
          const SizedBox(height: AppSpacing.xxl),
          Text(
            l10n.preparingImage,
            style: AppTypography.bodyMedium.copyWith(
              color: colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Error ──────────────────────────────────────────────────────────────────

class _ErrorBody extends ConsumerWidget {
  const _ErrorBody({required this.message, required this.retryable});

  final String message;
  final bool retryable;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);

    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AppErrorState(
            message: message,
            compact: true,
            onRetry: retryable
                ? () => ref.read(verifyControllerProvider.notifier).retry()
                : null,
            retryLabel: l10n.retryLabel,
          ),
          if (!retryable)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.md),
              child: AppButton(
                label: l10n.backToVerify,
                variant: AppButtonVariant.secondary,
                onPressed: () =>
                    ref.read(verifyControllerProvider.notifier).retry(),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Cards ──────────────────────────────────────────────────────────────────

/// Large tappable action card. Not [AppCard]: the primary card carries an
/// accent-tinted fill and accent border, which AppCard (default/outlined/
/// tinted only) cannot express without per-screen overrides.
class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.onTap,
    this.highlighted = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color accent;
  final VoidCallback onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      label: title,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadii.radiusLg,
          child: Ink(
            decoration: BoxDecoration(
              color: highlighted
                  ? accent.withValues(alpha: 0.08)
                  : colors.surface,
              borderRadius: AppRadii.radiusLg,
              border: Border.all(
                color: highlighted
                    ? accent.withValues(alpha: 0.35)
                    : colors.border,
              ),
              boxShadow: highlighted ? AppShadows.none : AppShadows.elevation1,
            ),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.xxl,
            ),
            child: Column(
              children: [
                Icon(icon, size: 48, color: highlighted ? accent : colors.textPrimary),
                const SizedBox(height: AppSpacing.md),
                Text(
                  title,
                  style: AppTypography.headingSmall.copyWith(
                    color: colors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  subtitle,
                  style: AppTypography.bodySmall.copyWith(
                    color: colors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Credits info card. Rendered only once a submit response has carried a
/// balance snapshot: the API has no standalone balance endpoint, and showing
/// a made-up number would be worse than showing nothing.
///
/// TODO(step25): make the card navigate to /billing once that route exists.
class _CreditsCard extends ConsumerWidget {
  const _CreditsCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final credits = ref.watch(verifyCreditsProvider);
    if (credits == null) return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final label = credits.unlimited
        ? l10n.unlimitedVerifications
        : l10n.verificationsRemaining(credits.balanceValue);

    return Container(
      padding: AppSpacing.insetMd,
      decoration: BoxDecoration(
        color: colors.surfaceAlt,
        borderRadius: AppRadii.radiusMd,
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline, size: 18, color: colors.textSecondary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              label,
              style: AppTypography.bodySmall.copyWith(
                color: colors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
