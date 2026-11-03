// Verdict hero: the one thing the merchant must read, in 300 ms.
//
// Motion budget is a single 200 ms opacity fade on the hero icon. Nothing
// bounces, nothing repeats, nothing waits for a timer to start the page.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/fintech/amount_text.dart';
import '../../data/models/verification_result.dart';
import '../verdict_copy.dart';

class VerdictHero extends StatefulWidget {
  const VerdictHero({super.key, required this.result});

  final VerificationResult result;

  @override
  State<VerdictHero> createState() => _VerdictHeroState();
}

class _VerdictHeroState extends State<VerdictHero>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _opacity = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    // Start after the first frame so the fade is visible instead of being
    // folded into the route transition.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _controller.forward();
      unawaited(_haptic(widget.result.status));
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _haptic(VerificationStatus status) {
    return switch (status) {
      VerificationStatus.verified => HapticFeedback.mediumImpact(),
      VerificationStatus.fake || VerificationStatus.error => HapticFeedback.heavyImpact(),
      _ => HapticFeedback.lightImpact(),
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final status = widget.result.status;
    final accent = verdictAccent(colors, status);
    final headline = verdictHeadline(l10n, status);
    final subtitle = verdictSubtitle(l10n, widget.result);
    final amount = widget.result.amountMinorValue;

    return Semantics(
      container: true,
      label: subtitle == null ? headline : '$headline. $subtitle',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.xxl,
        ),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.08),
          borderRadius: AppRadii.radiusLg,
          border: Border.all(color: accent.withValues(alpha: 0.20)),
        ),
        child: Column(
          children: [
            FadeTransition(
              key: const ValueKey('verdictHeroIcon'),
              opacity: _opacity,
              child: Icon(verdictIcon(status), size: 72, color: accent),
            ),
            const SizedBox(height: AppSpacing.lg),
            if (amount != null)
              AmountText(amountMinor: amount, size: AmountTextSize.display)
            else
              Text(
                '—',
                style: AppTypography.displayMedium.copyWith(
                  color: colors.textPrimary,
                ),
              ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              headline,
              style: AppTypography.headingSmall.copyWith(color: accent),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                subtitle,
                style: AppTypography.bodySmall.copyWith(
                  color: colors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Accent for a status. All colors are theme tokens — no hex outside
/// app_colors.dart.
Color verdictAccent(AppColors colors, VerificationStatus status) {
  return switch (status) {
    VerificationStatus.verified => colors.success,
    VerificationStatus.fake => colors.error,
    VerificationStatus.duplicate => colors.warning,
    VerificationStatus.needsReview => colors.info,
    VerificationStatus.error => colors.error,
    VerificationStatus.pending => colors.textSecondary,
  };
}

IconData verdictIcon(VerificationStatus status) {
  return switch (status) {
    VerificationStatus.verified => Icons.check_circle_rounded,
    VerificationStatus.fake => Icons.cancel_rounded,
    VerificationStatus.duplicate => Icons.content_copy_rounded,
    VerificationStatus.needsReview => Icons.schedule_rounded,
    VerificationStatus.error => Icons.warning_amber_rounded,
    VerificationStatus.pending => Icons.hourglass_top_rounded,
  };
}
