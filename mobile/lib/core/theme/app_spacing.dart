import 'package:flutter/material.dart';

/// # AppSpacing — 8pt Grid System
///
/// All spacing values in the app derive from this 8pt grid.
/// Never hardcode padding, margin, or gap values in widgets.
///
/// ## Usage
/// ```dart
/// Padding(
///   padding: AppSpacing.insetLg,   // EdgeInsets.all(16)
///   child: ...,
/// )
/// SizedBox(height: AppSpacing.md)  // 12
/// ```
abstract final class AppSpacing {
  // ─── Base scale ──────────────────────────────────────────────────────────

  /// 2px — micro gap, rarely used directly.
  static const double micro = 2;

  /// 4px — extra-small (xs).
  static const double xs = 4;

  /// 8px — small (sm). Icon gaps, tight list spacing.
  static const double sm = 8;

  /// 12px — medium (md). Inner card padding on tight screens.
  static const double md = 12;

  /// 16px — large (lg). Standard screen horizontal padding.
  static const double lg = 16;

  /// 20px — extra-large (xl). Bottom-nav clearance, section separation.
  static const double xl = 20;

  /// 24px — 2×xl (xxl). Generous card padding, tablet screen padding.
  static const double xxl = 24;

  /// 32px — 4×sm (xxxl). Section breaks, hero spacing.
  static const double xxxl = 32;

  /// 40px — huge. Onboarding illustration margins.
  static const double huge = 40;

  /// 48px — giant. Splash / empty-state vertical centering.
  static const double giant = 48;

  /// 64px — colossal. Rarely used; large empty-state illustrations.
  static const double colossal = 64;

  // ─── Semantic insets (EdgeInsets) ────────────────────────────────────────

  /// `EdgeInsets.all(4)` — tiny inset for badges, small chips.
  static const EdgeInsets insetXs = EdgeInsets.all(xs);

  /// `EdgeInsets.all(8)` — small inset for compact UI.
  static const EdgeInsets insetSm = EdgeInsets.all(sm);

  /// `EdgeInsets.all(12)` — medium inset.
  static const EdgeInsets insetMd = EdgeInsets.all(md);

  /// `EdgeInsets.all(16)` — standard screen/card padding.
  static const EdgeInsets insetLg = EdgeInsets.all(lg);

  /// `EdgeInsets.all(24)` — generous padding (tablets, modals).
  static const EdgeInsets insetXxl = EdgeInsets.all(xxl);

  /// Standard horizontal screen padding for phones.
  static const EdgeInsets screenH = EdgeInsets.symmetric(horizontal: lg);

  /// Standard screen padding (horizontal 16, vertical 16).
  static const EdgeInsets screen = EdgeInsets.symmetric(horizontal: lg, vertical: lg);

  /// Standard card inner padding.
  static const EdgeInsets card = EdgeInsets.all(lg);

  /// Horizontal padding for tablet screens.
  static const EdgeInsets screenHTablet = EdgeInsets.symmetric(horizontal: xxl);

  // ─── Min tap target ───────────────────────────────────────────────────────

  /// Minimum interactive tap target size (WCAG + Material 3 recommendation).
  static const double minTapTarget = 48;
}
