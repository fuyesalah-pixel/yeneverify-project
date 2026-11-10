import 'package:flutter/material.dart';

/// # AppColors — Single Source of Color Truth
///
/// This is the ONLY file in the project that may contain hex color values.
/// Every widget, component, and theme reads colors from this class via
/// [AppColorsExtension] (`context.colors.*`).
///
/// ## Rules
/// - Never add `Color(0xFF...)` or `Colors.*` anywhere else.
/// - To add a new color: add the token here first, justify it in a comment,
///   then use it. Do not use unnamed colors inline.
/// - Light and dark palettes are separate instances; [AppTheme] passes the
///   correct one as a [ThemeExtension].
///
/// ## Changing the brand color
/// Edit [primaryAction] in [AppColors.light] and [AppColors.dark].
/// That is the ONLY change needed for a brand-color swap.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  // ─── Constructor ─────────────────────────────────────────────────────────

  const AppColors({
    required this.background,
    required this.surface,
    required this.surfaceAlt,
    required this.textPrimary,
    required this.textSecondary,
    required this.textDisabled,
    required this.onPrimary,
    required this.primaryAction,
    required this.primaryActionPressed,
    required this.primaryActionDisabled,
    required this.brandAccent,
    required this.brandDeep,
    required this.success,
    required this.warning,
    required this.error,
    required this.info,
    required this.border,
    required this.divider,
    required this.overlay,
    required this.snackbarBackground,
    required this.shimmerBase,
    required this.shimmerHighlight,
  });

  // ─── Tokens ──────────────────────────────────────────────────────────────

  /// Screen background — the furthest-back layer.
  final Color background;

  /// Cards, sheets, elevated surfaces — one step above [background].
  final Color surface;

  /// Input fields, chips, secondary surfaces — one step above [surface].
  final Color surfaceAlt;

  /// Main body text. Near-black in light mode for warmth.
  final Color textPrimary;

  /// Supporting text, labels, captions.
  final Color textSecondary;

  /// Disabled text — below WCAG threshold intentionally (disabled = inactive).
  final Color textDisabled;

  /// Text/icon color drawn ON TOP of [primaryAction].
  /// Light: white (#FFFFFF). Dark: near-black (#0A0A0A) — neon needs dark text.
  final Color onPrimary;

  /// Primary CTA: buttons, active links, filled primary elements.
  /// Light: #16A34A. Dark: #22C55E.
  final Color primaryAction;

  /// Pressed / tap state of [primaryAction].
  final Color primaryActionPressed;

  /// Disabled state of [primaryAction].
  final Color primaryActionDisabled;

  /// Brand accent: checkmark, active tab indicators, progress rings,
  /// small highlights.
  /// ⚠️  NEVER use as a text background — fails WCAG with white text.
  final Color brandAccent;

  /// Deep brand green for gradients and high-emphasis brand surfaces.
  final Color brandDeep;

  /// VERIFIED state, positive outcomes, success toasts.
  final Color success;

  /// Low-credit warnings, caution states.
  final Color warning;

  /// FAKE verdict, destructive actions, error toasts.
  final Color error;

  /// Neutral notices, info banners.
  final Color info;

  /// Card outlines, input borders, dividers with weight.
  final Color border;

  /// Thin 1px separators between list items.
  final Color divider;

  /// Modal scrim / bottom-sheet backdrop.
  final Color overlay;

  /// Background for snackbar/toast — always near-black regardless of theme
  /// so snackbars are consistently visible in both light and dark modes.
  final Color snackbarBackground;

  /// Base color of shimmer skeleton loaders.
  final Color shimmerBase;

  /// Highlight sweep color of shimmer skeleton loaders.
  final Color shimmerHighlight;

  /// Fully transparent — used for status bar color and ghost backgrounds.
  static const Color transparent = Color(0x00000000);

  /// The official Yene Verify **light** palette.
  static const AppColors light = AppColors(
    background: Color(0xFFFFFFFF),
    surface: Color(0xFFF3F4F6),
    surfaceAlt: Color(0xFFE9EDEA),
    textPrimary: Color(0xFF14231A),
    textSecondary: Color(0xFF4B5563),
    textDisabled: Color(0xFF9CA3AF),
    onPrimary: Color(0xFFFFFFFF), // white text on green button
    primaryAction: Color(0xFF16A34A), // brand primary — WCAG AA on white
    primaryActionPressed: Color(0xFF0A5F2A), // deep brand green
    primaryActionDisabled: Color(0xFFA7D9B8),
    brandAccent: Color(0xFF44C624), // lime highlight — never text background
    brandDeep: Color(0xFF0A5F2A),
    success: Color(0xFF16A34A),
    warning: Color(0xFFF59E0B),
    error: Color(0xFFDC2626),
    info: Color(0xFF2563EB),
    border: Color(0xFFE5E7EB),
    divider: Color(0xFFF0F2F0),
    overlay: Color(0x73000000), // rgba(0,0,0,0.45)
    snackbarBackground: Color(0xFF0A0F0C),
    shimmerBase: Color(0xFFEDEFF2),
    shimmerHighlight: Color(0xFFF7F8FA),
  );

  // ─── Dark palette ────────────────────────────────────────────────────────

  /// The official Yene Verify **dark** palette.
  static const AppColors dark = AppColors(
    background: Color(0xFF000000),
    surface: Color(0xFF0A0F0C),
    surfaceAlt: Color(0xFF132019),
    textPrimary: Color(0xFFF3F4F6),
    textSecondary: Color(0xFF9CA3AF),
    textDisabled: Color(0xFF4B5A51),
    onPrimary: Color(0xFF04150C), // near-black text on green button
    primaryAction: Color(0xFF22C55E),
    primaryActionPressed: Color(0xFF16A34A),
    primaryActionDisabled: Color(0xFF14532D),
    brandAccent: Color(0xFF44C624),
    brandDeep: Color(0xFF0B2A17),
    success: Color(0xFF22C55E),
    warning: Color(0xFFFBBF24),
    error: Color(0xFFF87171),
    info: Color(0xFF60A5FA),
    border: Color(0xFF1F2A23),
    divider: Color(0xFF151C18),
    overlay: Color(0xA6000000), // rgba(0,0,0,0.65)
    snackbarBackground: Color(0xFF121814),
    shimmerBase: Color(0xFF141B17),
    shimmerHighlight: Color(0xFF1F2A23),
  );

  // ─── ThemeExtension overrides ─────────────────────────────────────────────

  @override
  AppColors copyWith({
    Color? background,
    Color? surface,
    Color? surfaceAlt,
    Color? textPrimary,
    Color? textSecondary,
    Color? textDisabled,
    Color? onPrimary,
    Color? primaryAction,
    Color? primaryActionPressed,
    Color? primaryActionDisabled,
    Color? brandAccent,
    Color? brandDeep,
    Color? success,
    Color? warning,
    Color? error,
    Color? info,
    Color? border,
    Color? divider,
    Color? overlay,
    Color? snackbarBackground,
    Color? shimmerBase,
    Color? shimmerHighlight,
  }) {
    return AppColors(
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceAlt: surfaceAlt ?? this.surfaceAlt,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textDisabled: textDisabled ?? this.textDisabled,
      onPrimary: onPrimary ?? this.onPrimary,
      primaryAction: primaryAction ?? this.primaryAction,
      primaryActionPressed: primaryActionPressed ?? this.primaryActionPressed,
      primaryActionDisabled:
          primaryActionDisabled ?? this.primaryActionDisabled,
      brandAccent: brandAccent ?? this.brandAccent,
      brandDeep: brandDeep ?? this.brandDeep,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      error: error ?? this.error,
      info: info ?? this.info,
      border: border ?? this.border,
      divider: divider ?? this.divider,
      overlay: overlay ?? this.overlay,
      snackbarBackground: snackbarBackground ?? this.snackbarBackground,
      shimmerBase: shimmerBase ?? this.shimmerBase,
      shimmerHighlight: shimmerHighlight ?? this.shimmerHighlight,
    );
  }

  @override
  AppColors lerp(AppColors? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceAlt: Color.lerp(surfaceAlt, other.surfaceAlt, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textDisabled: Color.lerp(textDisabled, other.textDisabled, t)!,
      onPrimary: Color.lerp(onPrimary, other.onPrimary, t)!,
      primaryAction: Color.lerp(primaryAction, other.primaryAction, t)!,
      primaryActionPressed:
          Color.lerp(primaryActionPressed, other.primaryActionPressed, t)!,
      primaryActionDisabled:
          Color.lerp(primaryActionDisabled, other.primaryActionDisabled, t)!,
      brandAccent: Color.lerp(brandAccent, other.brandAccent, t)!,
      brandDeep: Color.lerp(brandDeep, other.brandDeep, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      error: Color.lerp(error, other.error, t)!,
      info: Color.lerp(info, other.info, t)!,
      border: Color.lerp(border, other.border, t)!,
      divider: Color.lerp(divider, other.divider, t)!,
      overlay: Color.lerp(overlay, other.overlay, t)!,
      snackbarBackground:
          Color.lerp(snackbarBackground, other.snackbarBackground, t)!,
      shimmerBase: Color.lerp(shimmerBase, other.shimmerBase, t)!,
      shimmerHighlight:
          Color.lerp(shimmerHighlight, other.shimmerHighlight, t)!,
    );
  }
}
