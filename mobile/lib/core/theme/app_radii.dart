import 'package:flutter/material.dart';

/// # AppRadii — Border Radius Tokens
///
/// All border radii in the app come from this file.
/// Never hardcode `BorderRadius.circular(x)` values in widgets.
///
/// ## Mapping
/// | Token  | Value | Used for                         |
/// |--------|-------|----------------------------------|
/// | none   | 0     | Sharp edges (dividers, full-bleed)|
/// | sm     | 8     | Small chips, tags, badges         |
/// | md     | 12    | Buttons, text inputs              |
/// | lg     | 16    | Cards, modals                     |
/// | xl     | 20    | Bottom sheets (top corners only)  |
/// | pill   | 999   | Avatars, pills, FABs              |
abstract final class AppRadii {
  static const double none = 0;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double pill = 999;

  // ─── BorderRadius helpers ──────────────────────────────────────────────

  static const BorderRadius radiusNone = BorderRadius.zero;
  static BorderRadius radiusSm = BorderRadius.circular(sm);
  static BorderRadius radiusMd = BorderRadius.circular(md);
  static BorderRadius radiusLg = BorderRadius.circular(lg);
  static BorderRadius radiusXl = BorderRadius.circular(xl);
  static BorderRadius radiusPill = BorderRadius.circular(pill);

  /// Bottom sheet: only top corners rounded.
  static BorderRadius sheetTop = const BorderRadius.only(
    topLeft: Radius.circular(xl),
    topRight: Radius.circular(xl),
  );

  // ─── BorderRadiusGeometry constants ───────────────────────────────────

  /// Convenience [BorderRadiusGeometry] versions for use in decoration.
  static BorderRadiusGeometry get cardGeometry => radiusLg;
  static BorderRadiusGeometry get buttonGeometry => radiusMd;
  static BorderRadiusGeometry get inputGeometry => radiusMd;
  static BorderRadiusGeometry get chipGeometry => radiusSm;
  static BorderRadiusGeometry get avatarGeometry => radiusPill;
  static BorderRadiusGeometry get sheetGeometry => sheetTop;
}
