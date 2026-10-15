import 'package:flutter/material.dart';

/// # AppTypography — Type Scale
///
/// All text styles in the app come from this file.
/// Never hardcode font sizes, weights, or line heights in widgets.
///
/// ## Font families
/// - **Inter** — all UI text (EN and number-heavy components).
/// - **NotoSansEthiopic** — Amharic text only, loaded conditionally.
///
/// ## Usage
/// ```dart
/// Text('Hello', style: AppTypography.headingLarge)
/// Text('5,500.00 ETB', style: AppTypography.displayMedium)
/// Text(ref, style: AppTypography.mono)
/// ```
///
/// ## Overriding color
/// Always provide color via [TextStyle.copyWith]:
/// ```dart
/// AppTypography.bodyMedium.copyWith(color: context.colors.textSecondary)
/// ```
/// Never pass raw color values — use tokens.
abstract final class AppTypography {
  // ─── Font family constants ────────────────────────────────────────────────

  static const String _inter = 'Inter';
  static const String _notoEthiopic = 'NotoSansEthiopic';

  /// Primary font — use for all EN / digit-heavy text.
  static const String primaryFamily = _inter;

  /// Amharic font — load only when AM locale is active.
  static const String amharicFamily = _notoEthiopic;

  // ─── Tabular figures feature ──────────────────────────────────────────────

  /// Use for monetary amounts and transaction IDs so digits don't shift width.
  static const List<FontFeature> tabularFigures = [
    FontFeature.tabularFigures(),
  ];

  // ─── Scale ───────────────────────────────────────────────────────────────

  /// 32/40/700 — Splash hero, large metric on result screen.
  static const TextStyle displayLarge = TextStyle(
    fontFamily: _inter,
    fontSize: 32,
    height: 1.25, // 40 / 32
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
  );

  /// 28/36/700 — Result screen amount, key metric.
  static const TextStyle displayMedium = TextStyle(
    fontFamily: _inter,
    fontSize: 28,
    height: 1.285, // 36 / 28
    fontWeight: FontWeight.w700,
    letterSpacing: -0.3,
    fontFeatures: tabularFigures,
  );

  /// 24/32/700 — Screen titles (AppBar title).
  static const TextStyle headingLarge = TextStyle(
    fontFamily: _inter,
    fontSize: 24,
    height: 1.333, // 32 / 24
    fontWeight: FontWeight.w700,
    letterSpacing: -0.2,
  );

  /// 20/28/600 — Section headers inside a screen.
  static const TextStyle headingMedium = TextStyle(
    fontFamily: _inter,
    fontSize: 20,
    height: 1.4, // 28 / 20
    fontWeight: FontWeight.w600,
  );

  /// 18/24/600 — Card titles, sheet headers.
  static const TextStyle headingSmall = TextStyle(
    fontFamily: _inter,
    fontSize: 18,
    height: 1.333, // 24 / 18
    fontWeight: FontWeight.w600,
  );

  /// 16/24/400 — Primary body text.
  static const TextStyle bodyLarge = TextStyle(
    fontFamily: _inter,
    fontSize: 16,
    height: 1.5, // 24 / 16
    fontWeight: FontWeight.w400,
  );

  /// 14/20/400 — Secondary body, list subtitles.
  static const TextStyle bodyMedium = TextStyle(
    fontFamily: _inter,
    fontSize: 14,
    height: 1.428, // 20 / 14
    fontWeight: FontWeight.w400,
  );

  /// 12/16/400 — Captions, timestamps, fine print.
  static const TextStyle bodySmall = TextStyle(
    fontFamily: _inter,
    fontSize: 12,
    height: 1.333, // 16 / 12
    fontWeight: FontWeight.w400,
  );

  /// 16/20/600 — Button labels.
  static const TextStyle labelLarge = TextStyle(
    fontFamily: _inter,
    fontSize: 16,
    height: 1.25, // 20 / 16
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
  );

  /// 14/18/500 — Chips, tab labels, secondary buttons.
  static const TextStyle labelMedium = TextStyle(
    fontFamily: _inter,
    fontSize: 14,
    height: 1.285, // 18 / 14
    fontWeight: FontWeight.w500,
  );

  /// 12/16/500 — Badges, tiny labels.
  static const TextStyle labelSmall = TextStyle(
    fontFamily: _inter,
    fontSize: 12,
    height: 1.333, // 16 / 12
    fontWeight: FontWeight.w500,
  );

  /// 14/20/500 — Transaction references, bank codes, IDs.
  /// Uses tabular figures so characters don't jitter.
  static const TextStyle mono = TextStyle(
    fontFamily: _inter,
    fontSize: 14,
    height: 1.428,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.3,
    fontFeatures: tabularFigures,
  );

  // ─── TextTheme helper ─────────────────────────────────────────────────────

  /// Maps the scale onto Material 3's [TextTheme] so Material widgets
  /// (AppBar, Dialog, etc.) automatically use the correct styles.
  static TextTheme get textTheme => const TextTheme(
        displayLarge: displayLarge,
        displayMedium: displayMedium,
        headlineLarge: headingLarge,
        headlineMedium: headingMedium,
        headlineSmall: headingSmall,
        bodyLarge: bodyLarge,
        bodyMedium: bodyMedium,
        bodySmall: bodySmall,
        labelLarge: labelLarge,
        labelMedium: labelMedium,
        labelSmall: labelSmall,
      );
}
